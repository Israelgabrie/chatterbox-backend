const { userModel } = require("../database");

const addNewDeviceDetails = async (socket, userId) => {
    try {
        const updatedUserDetails = await userModel.updateOne(
            { _id: userId }, // Find the user by ID
            { $push: { loginDetails: { socketId: socket.id } } } // Push the new object to the loginDetails array
        );

        if (updatedUserDetails.matchedCount === 0) {
            // If no user found
            console.log(`No user found with ID: ${userId}`);
            socket.emit("serverError", "No user found with the provided ID");
        } else {
            // If the user is found and updated successfully
            // console.log(`Device successfully registered for user ID: ${userId}`);
            socket.emit("serverSuccess", "Device Successfully Registered");
        }
    } catch (error) {
        console.error("An error occurred while adding a new device:", error);
        socket.emit("serverError", error.message); // Emit error message to the client
    }
};

const removeDeviceDetails = async (socket) => {
    try {
        console.log("removing old device from the backend "+socket.id);
        const updatedUserDetails = await userModel.updateOne(
            { 'loginDetails.socketId': socket.id }, // Find the user with the matching socketId
            { $pull: { loginDetails: { socketId: socket.id } } } // Remove the object from the loginDetails array
        );

        if (updatedUserDetails.matchedCount === 0) {
            // If no user found with the given socketId
            console.log(`No user found with socket ID: ${socket.id}`);
            socket.emit("serverError", "No user found with the provided socket ID");
        } else {
            // If the login detail is removed successfully
            console.log(`Device successfully removed for socket ID: ${socket.id}`);
            socket.emit("serverSuccess", "Device Successfully Removed");
        }
    } catch (error) {
        console.error("An error occurred while removing the device:", error);
        socket.emit("serverError", error.message); // Emit error message to the client
    }
};

const returnChatsFound = async(socket,chatName) => {
    const chatsFound = await userModel.findOne({});
    console.log(chatsFound)

    // socket.emit("chatsFound",chatsFound);

}

module.exports = {
    addNewDeviceDetails,
    removeDeviceDetails,
    returnChatsFound
};
