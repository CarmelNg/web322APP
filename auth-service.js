const { rejects } = require('assert');
const mongoose = require('mongoose');
const { resolve } = require('path');
var Schema = mongoose.Schema;
var userSchema = new Schema({           // creating user schema with userName, password, email, and loginHistory as members
    "userName": {
        type : String,
        unique : true
    } ,
    "password": String,
    "email": String,
    "loginHistory": [{
      "dateTime": Date,
      "userAgent": String
    }]
  });

let User; // to be defined on new connection (see initialize)

module.exports.initialize = function () {
    return new Promise(function (resolve, reject) {
        //let pass1 = encodeURIComponent("process.env.#KaranMan1");     //not working
        let db1 = mongoose.createConnection("mongodb+srv://Amitoj:%23KaranMan1@senecaweb.kjs2lm1.mongodb.net/?retryWrites=true&w=majority");
        // %23 in above means #. Putting only # will cause error
        db1.on('error', (err)=>{
            reject(err); // reject the promise with the provided error
        });
        db1.once('open', ()=>{
           User = db1.model("users", userSchema);
           resolve();
        });
    });
};


module.exports.registerUser = function (userData) {
    return new Promise(function (resolve, reject) {

        if(userData.password != userData.password2)     //password and confirm password doesnt match
        {
            reject("Passwords do not match");
        }
        else        //passwords match
        {
            let newUser = new User(userData);
            newUser.save().then(() => {
                // everything good
                resolve();
              }).catch(err => {
                if(err.code == 11000)       //check if user name is already taken 
                {
                    reject("User Name already taken");
                }
                else                        //any other type of error
                {
                    reject("There was an error creating the user: " + err);
                }
              });
        }
    });
};


module.exports.checkUser = function (userData) {
    return new Promise(function (resolve, reject) {
        User.find({ userName: userData.userName })          // trying to find a user with username as provide by userData
        .exec()
        .then((users) => {
            if(users[0].password != userData.password)      // if entered password doesnt match
            {
                reject("Incorrect Password for user: " + userData.userName)
            }
            else if(users[0].password == userData.password)     // else if entered password was correct
            {
                //recording history in loginHistory by using push method
                users[0].loginHistory.push({dateTime: (new Date()).toString(), userAgent: userData.userAgent});

                User.updateOne({userName : users[0].userName}, {$set : {loginHistory : users[0].loginHistory}})
                .exec().then(() => {    resolve(users[0]);  }).catch((err) =>  reject("There was an error verifying the user: " + err     ));
            }
          
        })
        .catch((err) => {
            console.log(err);
            reject("Unable to find user: " + userData.userName)
        });
    });
};