const express = require("express");
const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();
app.use(express.json());
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "twitterClone.db");

let database = null;

const initializeDBAndServer = async () => {
  try {
    database = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

//api1

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const checkUser = `select * from user where username = '${username}'`;
  const dbUser = await database.get(checkUser);
  console.log(dbUser);
  if (dbUser !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const requestQuery = `insert into user(name, username,password, gender) values(
                '${name}', '${username}', ${hashedPassword}, '${gender}'
            );`;
      await database.run(requestQuery);
      response.status(200);
      response.send("User created successfully");
    }
  }
});

//api2
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await database.get(selectUserQuery);
  if (dbUser !== undefined) {
    const checkPassword = await bcrypt.compare(password, dbUser.password);
    if (checkPassword === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "secret_key");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});
//application jwt token
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  } else {
    response.status(401);
    response.send("Invalid JWT Token");
  }
  if (jwtToken !== undefined) {
    jwt.verify(jwtToken, "secret_key", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//api 3
app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getUserIdQuery = `select user_id from user where username = '${username}'`;
  const getUserId = await database.get(getUserIdQuery);
  const getFollowerIdsQuery = `select following_user_id from follower 
    where follower_user_id = ${getUserId.user_id};`;
  const getFollowersId = await database.all(getFollowerIdsQuery);
  const getFollowerIdsSimple = getFollowersId.map((eachItem) => {
    return eachItem.following_user_id;
  });
  const tweetQuery = `select user.username, tweet.tweet, tweet.date_time as dateTime 
     from user inner join tweet 
     on user.user_ids = tweet.user_id where user.user_id in (${getFollowerIdsSimple})
     order by tweet.date_time desc limit 4;`;
  const responseResult = await database.all(tweetQuery);
  response.send(responseResult);
});

//api4
app.get("/user/following/", authenticateToken, async (request, response) => {
  let { username } = request;
  let getUserQuery = `select user_id from user where username = '${username}';`;
  const getUserId = await database.get(getUserQuery);
  const getFollowerIdsQuery = `select following_user_id from follower where follower_user_id = ${getUserId.user_id};`;
  const getFollowerIdArray = await database.all(getFollowerIdsQuery);
  const getFollowerIds = getFollowerIdArray.map((eachUser) => {
    return eachUser.following_user_id;
  });
  const getFollowerResultQuery = `select name from user where user_id in (${getFollowerIds});`;
  const responseResult = await database.all(getFollowerResultQuery);
  response.send(responseResult);
});
//api5
app.get("/user/followers/", authenticateToken, async (request, response) => {
  let { username } = request;
  let getUserQuery = `select user_id from user where username = '${username}';`;
  const getUserId = await database.get(getUserQuery);
  const getFollowerIdsQuery = `select following_user_id from follower where follower_user_id = ${getUserId.user_id};`;
  const getFollowerIdArray = await database.all(getFollowerIdsQuery);
  const getFollowerIds = getFollowerIdArray.map((eachUser) => {
    return eachUser.following_user_id;
  });
  const getFollowerResultQuery = `select name from user where user_id in (${getFollowerIds});`;
  const responseResult = await database.all(getFollowerResultQuery);
  response.send(responseResult);
});

const apiOutput = (tweetData, likesCount, replyCount) => {
  return {
    tweet: tweetData.tweet,
    likes: likesCount.likes,
    replies: replyCount.replies,
    dateTime: tweetData.date_time,
  };
};

//api6

app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  let { username } = request;
  const getUserQuery = `select user_id from user where username = '${username}';`;
  const getUserId = await database.get(getUserQuery);
  const getFollowingIdsQuery = `select following_user_id from follower where follower_user_id = ${getUserId.user_id};`;
  const getFollowingIdsArray = await database.all(getFollowingIdsArray);
  const getFollowingIds = getFollowingIdsArray.map((eachItem) => {
    return eachItem.following_user_id;
  });

  const getTweetIdsQuery = `select tweet_id from tweet where user_id in (${getFollowingIds});`;
  const getTweetIdsArray = await database.all(getTweetIdsQuery);
  const followingTweetIds = getTweetIdsArray.map((eachId) => {
    return eachId.tweet_id;
  });

  if (followingTweetIds.include(parseInt(tweetId))) {
    const likes_count_query = `select count(user_id) as likes from like where tweet_id = ${tweetId};`;
    const likes_count = await database.get(likes_count_query);

    const reply_count_query = `select count(user_id) as replies from reply where tweet_id=${tweetId};`;
    const reply_count = await database.get(reply_count_query);

    const tweet_tweetDateQuery = `select tweet, date_time from tweet where tweet_id = ${tweetId};`;
    const tweet_tweetDate = await database.get(tweet_tweetDateQuery);

    response.send(apiOutput(tweet_tweetDate, likes_count, reply_count));
  } else {
    response.status(401);
    response.send("Invalid Request");
    console.log("Invalid Request");
  }
});

//api7
const convertLikesUserNameDbObjectToResponseObject = (dbObject) => {
  return {
    likes: dbObject,
  };
};
app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    let { username } = request;
    const getUserQuery = `select user_id from user where username = '${username}';`;
    const getUserId = await database.get(getUserQuery);

    const getFollowingIdsQuery = `select following_user_id from follower where follower_user_id = ${getUserId.user_id};`;
    const getFollowingIdsArray = await database.all(getFollowingIdsArray);
    const getFollowingIds = getFollowingIdsArray.map((eachItem) => {
      return eachItem.following_user_id;
    });

    const getTweetIdsQuery = `select tweet_id from tweet where user_id in (${getFollowingIds});`;
    const getTweetIdsArray = await database.all(getTweetIdsQuery);
    const followingTweetIds = getTweetIdsArray.map((eachId) => {
      return eachId.tweet_id;
    });
    if (followingTweetIds.includes(parseInt(tweetId))) {
      const getLikesUsersNameQuery = `select user.username as likes from user inner join like on 
      user.user_id=like.user_id where like.tweet_id = ${tweetId};`;
      const getLikesUserNameArray = await database.all(getLikesUsersNameQuery);

      const getLikesUserNames = getLikesUserNameArray.map((eachUSer) => {
        return eachUSer.likes;
      });
      response.send(
        convertLikesUserNameDbObjectToResponseObject(getLikesUserNames)
      );
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);
//api8
const convertUserNameReplyDbObject = (dbObject) => {
  return {
    replies: dbObject,
  };
};
app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    let { username } = request;
    const getUserQuery = `select user_id from user where username = '${username}';`;
    const getUserId = await database.get(getUserQuery);

    const getFollowingIdsQuery = `select following_user_id from follower where follower_user_id = ${getUserId.user_id};`;
    const getFollowingIdsArray = await database.all(getFollowingIdsArray);
    const getFollowingIds = getFollowingIdsArray.map((eachItem) => {
      return eachItem.following_user_id;
    });

    const getTweetIdsQuery = `select tweet_id from tweet where user_id in (${getFollowingIds});`;
    const getTweetIdsArray = await database.all(getTweetIdsQuery);
    const followingTweetIds = getTweetIdsArray.map((eachId) => {
      return eachId.tweet_id;
    });
    if (followingTweetIds.includes(parseInt(tweetId))) {
      const getUsernameReplyTweetQuery = `select user.name, reply.reply from user inner join reply on 
      user.user_id=reply.user_id where reply.tweet_id = ${tweetId};`;
      const getUserNameReplyTweets = await database.all(
        getUsernameReplyTweetQuery
      );
      response.send(convertUserNameReplyDbObject(getUserNameReplyTweets));
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

app.get("/user/tweets/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getUserQuery = `select user_id from user where username = '${username}';`;
  const getUserId = await database.get(getUserQuery);

  const getTweetIdsQuery = `select tweet_id from tweet where user_id in (${getUserId});`;
  const getTweetIdsArray = await database.all(getTweetIdsQuery);
  const followingTweetIds = getTweetIdsArray.map((eachId) => {
    return parseInt(eachId.tweet_id);
  });
});

app.post("/user/tweets/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getUserQuery = `select user_id from user where username = '${username}';`;
  const getUserId = await database.get(getUserQuery);

  const { tweet } = request.body;

  const currentData = new Date();

  const postRequestQuery = `insert into tweet(tweet, user_id, date_time) values(
      '${tweet}', ${getUserId.user_id}, '${currentData.date_time}'
  );`;
  const responseResult = await database.run(postRequestQuery);
  const tweet_id = responseResult.lastID;
  response.send("Created a Tweet");
});

app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request;
    const getUserQuery = `select user_id from user where username = '${username}';`;
    const getUserId = await database.get(getUserQuery);
    const getTweetIdsQuery = `select tweet_id from tweet where user_id = ${getUserId.user_id};`;
    const getTweetIdsArray = await database.all(getTweetIdsQuery);
    const followingTweetIds = getTweetIdsArray.map((eachId) => {
      return eachId.tweet_id;
    });
    if (followingTweetIds.include(parseInt(tweetId))) {
      const deleteTweetQuery = `delete from tweet where tweet_ids=${tweetId};`;
      await database.run(deleteTweetQuery);
      response.send("Tweet Removed");
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

module.exports = app;
