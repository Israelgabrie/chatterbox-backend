const mongoose = require("mongoose");
const mongoURI = 'mongodb://localhost:27017/chatterbox';
const mongoAtlasConnectionSring = "mongodb+srv://isrealgab3a:jYVPV3J9iQsIMYeJ@cluster0.k8jva.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Create a Mongoose connection object
let connection = null;

async function connectDB() {
  if (connection) {
    // Return the existing connection if already connected
    return connection;
  }

  try {
    // Connect to MongoDB and store the connection object
    connection = await mongoose.connect(mongoURI, {

    });
    console.log('MongoDB connected successfully');
    return connection;
  } catch (err) {
    console.error('MongoDB connection error:', err);
    connection = null; // Clear connection on failure
    return null;
  }
}

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  gender: {
    type: String
  },
  dateOfBirth: {
    type: Date
  },
  active: {
    type: Boolean,
    default: false
  },
  image: {
    type:{
      buffer:Buffer,
      contentType:String
    }
  },
  chats: {
    type: [
      {
        name: { type: String },
        isGroup: { type: Boolean, default: false },
        groupAdminId: { type: String },
        groupId: { type: String },
        participants: [String],
        friendId: { type: String } ,
        blocked: { type: Boolean, default: false },
        messages: [
          {
            message: { type: String, required: true },
            dateSent: { type: Date, default: Date.now },
            senderId: { type: String},
            receiverId: { type: String },
            type:{type :String , required: true}
          }
        ]
      }
    ]
  },
  requestMade: {
    type: [
      {
        name: { type: String },
        receiverId: { type: String, required: true }, // Removed unique: true
        timeOfRequest: { type: Date, default: Date.now },
        accepted: { type: Boolean, default: false }
      }
    ],
    default: []
  },
  requestReceived: {
    type: [
      {
        name: { type: String },
        senderId: { type: String, required: true }, // Removed unique: true
        timeOfRequest: { type: Date, default: Date.now },
        accepted: { type: Boolean, default: false }
      }
    ],
    default: []
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  verified: {
    type: Boolean,
    required: true,
    default: false
  },
  loginDetails: {
    type: [
      {
        loginTime: { type: Date, default: Date.now },
        socketId: { type: String }
      }
    ]
  },
  notifications:{
    type:[
      {
        title:{type: String},
        text:{type:String}
      }
    ]
  }
});

const User = mongoose.model('User', userSchema);

module.exports = User;





const otpSchema = new mongoose.Schema({
  otpCode: {
    type: String,
    required: true,
  },
  userId: {
    type: String,
    required: true,
    unique:true
  },
  createdAt: {
    type: Date,
    default: Date.now,  // Corrected syntax to use Date.now
  },
  expiryDate: {
    type: Date,
    default: function() { // Set expiryDate to 1 hour after creation
      return Date.now() + 60 * 60 * 1000; // 1 hour in milliseconds
    },
  },
});


// Create and export the user model
const userModel = mongoose.model('User', userSchema);

// create ans export user otp model
const otpModel = mongoose.model('otp', otpSchema);

// Export the connection object and connectDB function
module.exports = { connectDB, connection,userSchema,userModel,otpSchema,otpModel };
