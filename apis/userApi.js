const express = require("express")
const userRouter = express.Router();
const {connection,userSchema,userModel, otpSchema, otpModel} =  require("../database.js");
const nodemailer = require('nodemailer');
const {updateObject, setUserMailConfig, generateOtpCode,generateUserOtp} = require("../helperFunctions.js");
const bcrypt = require("bcrypt");
const { sendEmail } = require("../sendmails.js");
const saltRounds = 13;

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



userRouter.post("/checkName", async (req, res) => {
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

  userRouter.post("/login",(req,res)=>{
    try{

    }catch(error){
      console.error(error);
      res.send({ message: error.message,success:false });
    }
  })


module.exports = {userRouter,saltRounds}