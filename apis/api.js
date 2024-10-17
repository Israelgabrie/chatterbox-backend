const express = require('express');
const PORT = 3000;
const app = express();
const { connectDB, otpModel, userModel } = require('../database.js'); // Adjust the path as needed
app.use(express.json());
const bcrypt = require("bcrypt");

// importing use roruter and implementing it as middleware
const {userRouter,saltRounds}  = require("./userApi.js");
app.use("/user",userRouter);



// check otp code for email confirmation
app.post("/checkEmailCode", async (req, res) => {
  try {
    console.log("checking email code")
    const { otpCode, userId } = req.body;
    // check if otp exists
    const unCheckedUser = await otpModel.findOne({ userId: userId });
    if (unCheckedUser) {
      // if the user exists
      const validOtp = await bcrypt.compare(otpCode, unCheckedUser.otpCode); // await bcrypt.compare
      if (validOtp) {
        // if the otp code entered is valid
        if (unCheckedUser.expiryDate > new Date()) { // compare expiry date
          console.log("OTP validated successfully");
          await userModel.updateOne(
            { _id: unCheckedUser.userId },  // Query to match the document
            { $set: { verified: true } }    // Update operation
          )          
          await otpModel.deleteOne({userId:unCheckedUser.userId})
          res.send({ success: true, message: "OTP validated successfully" });
        } else {
          res.send({ success: false, message: "Verification code has expired" });
        }
      } else {
        // if otp is invalid
        res.send({ success: false, message: "Invalid code" });
      }
    } else {
      // if user doesn't exist
      res.send({ success: false, message: "Invalid code" });
    }
  } catch (error) {
    res.send({ success: false, message: error.message });
  }
});




async function startServer() {
  const isConnected = await connectDB();
  isConnected
    ? app.listen(PORT, () => console.log(`App is running on port ${PORT}`))
    : console.error('Failed to connect to MongoDB. Server not started.');
}

// Start the server
startServer();
