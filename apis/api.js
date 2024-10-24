const express = require('express');
const PORT = 3000;
const app = express();
const cors = require('cors');
const { connectDB, otpModel, userModel } = require('../database.js');
const bcrypt = require("bcrypt");
const jwt = require('jsonwebtoken');
const cookieParser = require("cookie-parser");
const socketIo = require('socket.io');
require('dotenv').config();
const { addNewDeviceDetails, removeDeviceDetails, returnChatsFound, addNewChat, cancelRequest, acceptRequest, addChatMessage } = require('./socketFunctions.js');


// Allow requests from all origins with specific methods and headers
// CORS Middleware
app.use(cors({
    origin: ['http://localhost:8081', 'http://192.168.199.80:8081'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
}));

// Middleware to parse JSON request bodies
app.use(express.json());

// Use cookie-parser middleware
app.use(cookieParser());

// Importing userRouter and implementing it as middleware
const { userRouter, saltRounds } = require("./userApi.js");
app.use("/user", userRouter);


async function sendCookies(res,cookieName,cookieValue,options){
    res.cookie(cookieName,cookieValue,options);
}


app.get("/checkTestRoute",async(req,res)=>{
    sendCookies(res,"messi","football");
   res.send({success:true,message:"test message",user:{verified:true}})
})

app.post("/testCookie",async(req,res)=>{
    res.cookie("cookieName","cookieValue");
    res.send("This is the cookie test response")
})


app.post("/login", async(req, res) => {
    try {
        console.log("logging user in from the backend")
        const { email, password, rememberMe } = req.body;
        console.log(JSON.stringify(req.cookies),"request cookies")
  
      // Check if email and password are provided
      if (!email || !password) {
        return res.status(400).send({ message: "Email and password are required", success: false });
      }
  
      // Find the user by email
      const user = await userModel.findOne({ email });
  
      // Check if user exists
      if (!user) {
        return res.status(404).send({ message: "User doesn't exist", success: false });
      }
  
      // Compare the password
      const isMatch = await bcrypt.compare(password, user.password);
      if (isMatch) {
        // If rememberMe is true, create a jwt token
        if (rememberMe) {
          const token = await jwt.sign({ userId: user._id }, process.env.REFRESH_TOKEN, { expiresIn: '60d' }); // 60 days
          console.log("user " + user.name + " logged in with jwt " + JSON.stringify({ userId: user._id }) + " and token is " + token);
  
          // Set cookie with proper settings for local development
          console.log("token before res cookie "+token)
          res.cookie('token', token, {
            maxAge: 5184000,   // 60 days in milliseconds
            httpOnly: true,    // Prevents client-side access to the cookie
            secure: false,     // Set to true in production (only over HTTPS)
            sameSite: 'Lax',   // Use 'Lax' for development with HTTP
            path: '/'          // Ensure this covers the whole site
          });     
        }
  
        // Return success response with user data and token
        return res.send({ success: true, message: "Login successful", user: { ...user.toObject() } });
      } else {
        return res.status(401).send({ success: false, message: "Invalid credentials" }); // Unauthorized status for invalid credentials
      }
    } catch (error) {
      console.error(error);
      res.status(500).send({ message: error.message, success: false });
    }
  });


// Check OTP code for email confirmation
app.post("/checkEmailCode", async (req, res) => {
    try {
        console.log("Checking email code");
        const { otpCode, userId } = req.body;
        
        // Check if OTP exists
        const unCheckedUser = await otpModel.findOne({ userId: userId });
        if (unCheckedUser) {
            // If the user exists
            const validOtp = await bcrypt.compare(otpCode, unCheckedUser.otpCode); // Compare OTP
            if (validOtp) {
                // If the OTP code entered is valid
                if (unCheckedUser.expiryDate > new Date()) { // Compare expiry date
                    await userModel.updateOne(
                        { _id: unCheckedUser.userId },  // Query to match the document
                        { $set: { verified: true } }    // Update operation
                    );
                    await otpModel.deleteOne({ userId: unCheckedUser.userId });
                    res.send({ success: true, message: "OTP validated successfully" });
                } else {
                    res.send({ success: false, message: "Verification code has expired" });
                }
            } else {
                // If OTP is invalid
                res.send({ success: false, message: "Invalid code" });
            }
        } else {
            // If user doesn't exist
            res.send({ success: false, message: "Invalid code" });
        }
    } catch (error) {
        res.send({ success: false, message: error.message });
    }
});

// Start the server and socket.io
async function startServer() {
    const isConnected = await connectDB();
    if (isConnected) {
        const server = app.listen(PORT, () => console.log(`App is running on port ${PORT}`));
        // Initialize Socket.io with CORS settings
        const io = socketIo(server, {
        cors: {
            origin: ['http://localhost:8081', 'http://192.168.199.80:8081'], // Same allowed origins
            methods: ['GET', 'POST'],
            allowedHeaders: ['Content-Type', 'Authorization'],
            credentials: true,
        },
    });

        io.on('connection', (socket) => {
            console.log('Socket connected:', socket.id);

            // when user is searching for chats
            socket.on("findChat",(chatName,user)=>{
                returnChatsFound(socket,chatName,user)
            })

            socket.on("addNewChat",(user,newChat,callback)=>{
                console.log("adding new chat")
                addNewChat(io,socket,user,newChat,callback);
            })  

            // cancel sent friend request
            socket.on("cancelRequest",async(user,cancelRequestId,callback)=>{
                cancelRequest(io,socket,user,cancelRequestId,callback);
            }) 

            // cancel sent friend request
            socket.on("acceptRequest",async(user,idToBeAccepted,callback)=>{
                acceptRequest(io,socket,user,idToBeAccepted,callback)               
            }) 

            // add new message
            socket.on("addMessage",async(textMessage,user,idOfReceiver,callback)=>{
                addChatMessage(io,socket,textMessage,user,idOfReceiver,callback)                              
            }) 


            // add new device details when they logg in
            socket.on("addDeviceDetails",(userId)=>{
              addNewDeviceDetails(socket,userId);
            })

            // runs when a socket discontes from the server
            socket.on('disconnect', () => {
                removeDeviceDetails(socket);
            });
        });
    } else {
        console.error('Failed to connect to MongoDB. Server not started.');
    }
}

// Start the server
startServer();
