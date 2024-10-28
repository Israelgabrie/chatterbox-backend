const express = require("express")
const userRouter = express.Router();
const {connection,userSchema,userModel, otpSchema, otpModel} =  require("../database.js");
const {updateObject, setUserMailConfig, generateOtpCode,generateUserOtp} = require("../helperFunctions.js");
const bcrypt = require("bcrypt");
const { sendEmail } = require("../sendmails.js");
const saltRounds = 13;
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
require('dotenv').config();

userRouter.use(cookieParser());


// helper function to get user by id
async function getUserById(userIdentity){
  const appUser = await userModel.findOne({_id:userIdentity});
  console.log("user found with token" + JSON.stringify(appUser));
  if(appUser){
    return appUser
  }else{
    return null
  }
}

// helper function to save user otp data
async function saveUserOtpCode(hashedOtp){
  try{
    const newUserOtp = new otpModel(hashedOtp);
    newUserOtp.save()
  .then((otpObject)=>{
    console.log("user otp saved successfully")
  })
  .catch((error)=>{
    console.log("error cooured when saving user otp "+error.message)
  })
  }catch(error){
    console.log("an error occured in saveUserOtpCode"+error.message)
  }
}



userRouter.post("/checkName", async (req, res) =>{ 
    try {
      const user = await userModel.findOne({ name: req.body.name });
      res.send({
        used: !!user,
        message: user ? "User Name is occupied" : "User Name is available",
        success:user ? false : true
      });
    } catch (error) {
      console.error(error);
      res.status(500).send({ message: error.message,success:false });
    }
  });

userRouter.post("/checkEmail", async (req, res) => {
    console.log("checking email")
   try {
     const user = await userModel.findOne({ email: req.body.email });
     res.send({
       used: !!user,
       message: user ? "Email is occupied" : "Email is available",
       success:user ? false : true
     });
   } catch (error) {
     console.error(error);
     res.status(500).send({ message:error.message,success:false });
   }
 }); 


 userRouter.post( "/setUser", async (req, res) => {
    try {
      const hasedPassword = await bcrypt.hash(req.body.password,saltRounds);
      const securedUser = await updateObject(req.body,"password",hasedPassword);
      const user = await new userModel(securedUser);
      await user.save()
      .then(async (user)=>{
        // generate the otp code
        const otpCode = await generateOtpCode();
        // genearte the object conatineing the user id and the otp code
        const userOtp = await generateUserOtp(user,otpCode);
        // hash the otp code 
        const hashedOtp = await bcrypt.hash(userOtp.otpCode,saltRounds);
        // update the otpcode to the hashed otp code
        const hashedUserOtp = await updateObject(userOtp,"otpCode",hashedOtp); 
        // save the opt to the database
        const saveOtp = saveUserOtpCode(hashedUserOtp);
        // config the email settings and send the email
        const mailConfig = await setUserMailConfig(req.body,userOtp.otpCode);
        const mailResult = await sendEmail(mailConfig);
        // api response if everthing went successfully
        res.send({success:true,message:"user added successfully",user:user});
      })
      .catch((err)=>{
        res.send({success:false,message:err.message})
        console.log("error adding user "+err.message)
      })
    } catch (error) {
      console.error(error);
      res.send({ message: error.message , success:false });
    }
  });    

  userRouter.post("/resendOtp", async (req, res) => {
    try {
        console.log("backend generating new otp code.....");
        const { userId, email } = req.body;

        // Generate a new OTP code
        const newOtpCode = generateOtpCode();

        // Hash the new OTP code
        const newHashedOtp = await bcrypt.hash(newOtpCode, saltRounds);

        // Update the existing OTP record in the database
        const otpUpdate = await otpModel.updateOne(
            { userId: userId },
            {
                otpCode: newHashedOtp,
                createdAt: new Date(),
                expiryDate: new Date(Date.now() + 3600000) // OTP valid for 1 hour
            },
            { upsert: true } // Create a new record if one does not exist
        );

        // Check if the OTP was updated successfully
        if (otpUpdate.matchedCount === 0) {
            // No existing OTP record, but check if the user exists
            const user = await userModel.findOne({ _id: userId });
            if (!user) {
                return res.status(404).send({ success: false, message: "User not found." });
            }

            // Create a new OTP record since it didn't exist
            await otpModel.create({
                userId: userId,
                otpCode: newHashedOtp,
                createdAt: new Date(),
                expiryDate: new Date(Date.now() + 3600000) // OTP valid for 1 hour
            });
        }

        // Configure the email settings and send the new OTP
        const mailConfig = await setUserMailConfig({ email }, newOtpCode);
        
        try {
           const sendEmailResponse =  await sendEmail(mailConfig); // Ensure we await the email sending
        } catch (emailError) {
            console.error("Error sending email:", emailError);
            return res.status(500).send({ success: false, message: "Failed to send OTP. Please try again later." });
        }

        // Send API response if everything went successfully
        res.send({ success: true, message: "New OTP sent successfully." });
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: error.message, success: false });
    }
});




userRouter.get('/checkToken', async (req, res) => {
  try {
    console.log("cookies",JSON.stringify(req.cookies));
    console.log("cookies",JSON.stringify(req.signedCookies));
    if (req.cookies && req.cookies.token) {  // Ensure accessToken exists

      console.log(req.cookies + "token gotten in the backend")
      await jwt.verify(req.cookies.token, process.env.REFRESH_TOKEN, async (error, decode) => {
        if (error) {
          console.log("usertoekn not valid in the backend " + error); 
          return res.status(401).send({ message: "Invalid token", success: false });
        } else {
          const user = await getUserById(decode.userId); // Await the getUserById result
          if (!user) {
            console.log("token verified but not user found " + JSON.stringify(decode)); 
            return res.status(404).send({ message: "User not found", success: false });
          }
          console.log("user found and sent to the frontend " + user) 
          res.send({
            message: "User token validated successfully",
            user: user, // Return the user object
            success: true
          });
        }
      });
    } else {
      return res.status(400).send({ success: false, message: "No cookies found in the request" });
    }
  } catch (error) {
    console.log("Error checking token: " + error.message);
    res.status(500).send({ success: false, message: error.message }); // Return error message in response
  }
});






module.exports = {userRouter,saltRounds}