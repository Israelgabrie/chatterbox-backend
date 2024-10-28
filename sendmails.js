const nodemailer = require('nodemailer');

// Function to send an email
async function sendEmail({ transporterObject, mailOptions }) {
  try {
    const transporter = await nodemailer.createTransport(transporterObject);
    // Send the email
    const info = await transporter.sendMail(mailOptions);

    return { success: true, message: "Email sent successfully" };
  } catch (error) {
    console.log("error sending user an email "+error.message)
    return { success: false, message: error.message };
  }
}

module.exports = { sendEmail };
