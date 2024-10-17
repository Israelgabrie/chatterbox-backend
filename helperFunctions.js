function updateObject(anObject, keyNameOfTheObject, newValue) {
  return {
    ...anObject,
    [keyNameOfTheObject]: newValue
  };
}

function omitKeys(obj, keys) {
  // Convert keys to an array if it's a string
  if (typeof keys === 'string') {
    keys = [keys];
  }

  // Create a new object without the specified keys
  const newObj = {};

  for (const key in obj) {
    if (obj.hasOwnProperty(key) && !keys.includes(key)) {
      newObj[key] = obj[key];
    }
  }

  return newObj;
}

function generateOtpCode() {
  return Math.floor(10000 + Math.random() * 90000).toString();
}


async function setUserMailConfig(requestBody,code) {
  const myEmail = "chatterboxchattapp@gmail.com"
  let transporterObject = {
    service: 'gmail',
    host: 'smtp.gmail.com',  // SMTP host
    port: 587,               // Port (587 for TLS or 465 for SSL)
    secure: false, 
    auth: {
      user: myEmail,
      pass: 'ojpb ppnx lwyo tcng',
    },
  };
  
  let mailOptions = {
    from: myEmail,
    to: requestBody.email,
    subject: 'Welcome to Chatterbox!',
    text: 'Welcome to Chatterbox! We are excited to have you here.',
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Chatterbox</title>
        <style>
          body {
              width: 100%;
              height: 100%;
              margin: 0;
              display: flex;
              flex-direction: column;
              padding-top:10px
          }
          
          .topBar {
              display: flex;
              flex-direction: row;
              justify-content: center;
              align-items: center;
              gap: 20px;
              width:100%;
              margin-left:auto;
              margin-right:auto;
          }
          
          .emailHead {
              font-family: sans-serif;
              font-weight: bold;
              font-size: 18px;
          }

          .otpCode {
              font-family: sans-serif;
              font-size: 23px;
              font-weight: bolder;
              text-align: center;
              margin-top: 20px;
              letter-spacing: 5px;
          }

          .emailMessage {
              font-family: sans-serif;
              font-size: 14px;
              text-align: center;
              margin-top: 15px;
          }
        </style>
      </head>
      <body>
        <div class="topBar">
          <img width="50" src="cid:logo" alt="Chatterbox Logo"/>
          <div class="emailHead">chatterbox</div>    
        </div>
        <div class="otpCode">5-digit Code: ${code}</div>
        <div class="emailMessage">
          Welcome to Chatterbox! We're excited to have you here. Connect with friends and meet new people. Start by creating your profile, then explore chat rooms that interest you. Don’t hesitate to reach out if you have any questions. Enjoy your time chatting and have fun!
        </div>
      </body>
      </html>
    `,
    attachments: [{
      filename: 'chatterbox logo.png',
      path: '../frontend/assets/images/chatterbox logo.png',
      cid: 'logo' // same cid value as in the html img src
    }]
  };
  
  return { transporterObject, mailOptions };
}

async function generateUserOtp(user,otpCode){
  const returnObject = {
    userId:user._id.toString(),
    otpCode:otpCode,
  }

  return returnObject
}

module.exports = { updateObject, setUserMailConfig,generateOtpCode,generateUserOtp,omitKeys };
