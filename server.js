const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const cors = require('cors')

const UserId = require('mongodb').ObjectId;
const MongoClient = require('mongodb').MongoClient;

const uri = "mongodb+srv://user:<password>@cluster0-oifw0.mongodb.net/test?retryWrites=true&w=majority";

MongoClient.connect(uri, (err, client) => {
  if (err) {
    console.log('Error occurred while connecting to MongoDB Atlas...\n', err);
    return process.exit(1);
  }
  let db = client.db("freeCodeCamp")
  let collection = db.collection("Exercise");
  console.log('Connected to MongoDB Atlas...');

  // perform actions on the collection object
  app.use(cors())

  app.use(bodyParser.urlencoded({
    extended: false
  }));
  app.use(bodyParser.json());


  app.use(express.static('public'));
  app.get('/', (req, res) => {
    res.sendFile(`${__dirname}/views/index.html`)
  });

  // Error Handling middleware
  app.use((err, req, res, next) => {
    let errCode, errMessage

    if (err.errors) {
      // mongoose validation error
      errCode = 400 // bad request
      const keys = Object.keys(err.errors)
      // report the first validation error
      errMessage = err.errors[keys[0]].message
    } else {
      // generic or custom error
      errCode = err.status || 500
      errMessage = err.message || 'Internal Server Error'
    }
    res.status(errCode).type('txt')
      .send(errMessage)
  })

  // Setup adding new user api
  app.post('/api/exercise/new-user', (req, res, next) => {
    let username = req.body.username;

    collection.findOne({
      username: username
    }, (err, data) => {
      if (err) {
        next(err)
      }
      if (data !== null) {
        next(`<p>User ${data.username} with id: ${data._id} already exists!</p>`)
      } else {
        collection.insert({
          username: username
        }, (err, results) => {
          if (err) {
            return res.json({
              'error': 'Could not add user'
            })
          }
          return res.json({
            username: results.ops[0].username,
            _id: results.ops[0]._id
          });
        })
      }
    })
  });

  app.get('/api/exercise/users', (req, res, next) => {
    collection.find({}, {
      username: 1,
      _id: 1
    }).toArray((err, arr) => {
      if (err) {
        next(err);
      }
      console.log(arr);
      res.send(arr);
    })
  });

  app.post('/api/exercise/add', (req, res, next) => {
    let userId = req.body.userId;
    let regex = /^(?=[a-f\d]{24}$)(\d+[a-f]|[a-f]+\d)/i;
    if (!regex.test(req.body.userId)) {
      next('Invalid ID');
    }
    collection.findOneAndUpdate({
        _id: UserId(req.body.userId)
      }, {
        $inc: {
          count: 1
        },
        $push: {
          log: {
            "description": req.body.description,
            "duration": req.body.duration,
            "date": req.body.date ? new Date(req.body.date).toDateString() : new Date().toDateString()
          }
        }
      }, {
        returnNewData: true
      },
      (err, data) => {
        if (err) {
          next('Invalid ID');
        }
        if (data.value === null) {
          next("UserId doesn't exist!" )
        } else {
          res.json({
            username: data.value.username,
            "description": req.body.description,
            "duration": req.body.duration,
            "date": req.body.date ? new Date(req.body.date).toDateString() : new Date().toDateString(),
            "_id": req.body.userId
          });
        }
      })
  });

  // GET /api/exercise/log?{userId}[&from][&to][&limit]
  app.get('/api/exercise/log', (req, res, next) => {
    console.log('Getting the user data');
    let id = req.query.userId;
    let from = req.query.from;
    let to = req.query.to;
    let limit = parseInt(req.query.limit);

    const maxUsers = (user) => {
      if (limit) {
        return user.slice(0, limit)
      } else {
        return user;
      }
    }
    let regex = /^(?=[a-f\d]{24}$)(\d+[a-f]|[a-f]+\d)/i;
    if (!regex.test(id)) {
      next('Invalid ID');
    }
    collection.findOne({
      _id: UserId(id)
    }, (err, data) => {
      if (err) {
        res.send(err);
      }
      if (data === null) {
        next('No such user Id in collection')
      }
      if (from || to) {
        let log = data.log;
        if (from) {
          let newLog = data.log.filter(ex => new Date(ex.date) > new Date(from))
          if (to) {
            newLog = newLog.filter(ex => new Date(ex.date) < new Date(to))
          }
          res.json({
            _id: id,
            username: data.username,
            count: maxUsers(newLog).length,
            log: maxUsers(newLog)
          })
        } else if (to) {
          log = data.log.filter(ex => new Date(ex.date) < new Date(to))
          res.json({
            _id: id,
            username: data.username,
            count: maxUsers(log).length,
            log: maxUsers(log)
          });
        } else {
          res.json({
            _id: id,
            username: data.username,
            count: maxUsers(data.log).length,
            log: maxUsers(data.log)
          });
        }
      }
    })
  });

  const listener = app.listen(process.env.PORT || 3000, () => {
    console.log(`Your app is listening on port ${listener.address().port}`)
  })

});
