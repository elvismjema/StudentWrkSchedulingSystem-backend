import db  from "../models/index.js";
import { randomBytes } from "crypto";
import logger from "../config/logger.js";

const User = db.user;
const Session = db.session;
const Op = db.Sequelize.Op;

const google_id = process.env.CLIENT_ID;
const STUDENT_EMAIL = "elvis.mjema@eagles.oc.edu".toLowerCase();
const MANAGER_EMAILS = new Set([
  "elvismjema04@gmail.com",
  "byibonheur@gmail.com",
  "muhirejonathan123@gmail.com",
].map((email) => email.toLowerCase()));

const determineRoleByEmail = (email) => {
  const normalizedEmail = (email || "").toLowerCase().trim();

  if (normalizedEmail === STUDENT_EMAIL) {
    return "student";
  }

  if (MANAGER_EMAILS.has(normalizedEmail)) {
    return "manager";
  }

  return "student";
};

const exports = {};

const createSessionToken = () => {
  // Opaque session token; session validity is enforced via DB session lookup.
  return randomBytes(48).toString("hex");
};

const verifyGoogleIdToken = async (idToken) => {
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(
      idToken,
    )}`,
  );

  if (!response.ok) {
    throw new Error(`Google token verification failed with status ${response.status}`);
  }

  const payload = await response.json();
  if (payload.aud !== google_id) {
    throw new Error("Google token audience mismatch");
  }

  return payload;
};

const fetchGoogleUserInfo = async (accessToken) => {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Google userinfo request failed with status ${response.status}`);
  }

  return response.json();
};

const exchangeGoogleCodeForTokens = async (code) => {
  const payload = new URLSearchParams({
    code,
    client_id: process.env.CLIENT_ID || "",
    client_secret: process.env.CLIENT_SECRET || "",
    redirect_uri: "postmessage",
    grant_type: "authorization_code",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: payload,
  });

  if (!response.ok) {
    throw new Error(`Google code exchange failed with status ${response.status}`);
  }

  return response.json();
};

exports.login = async (req, res) => {
  logger.info('Login attempt initiated');

  var googleToken = req.body.credential;

  let googleUser = {};

  try {
    googleUser = await verifyGoogleIdToken(googleToken);
    logger.debug(`Google authentication successful for email: ${googleUser.email}`);
  } catch (err) {
    logger.error(`Google token verification failed: ${err.message}`);
    return res.status(401).send({ message: "Invalid Google login token." });
  }

  let email = googleUser.email;
  let firstName = googleUser.given_name || "User";
  let lastName = googleUser.family_name || "";

  // if we don't have their email or name, we need to make another request
  // this is solely for testing purposes
  if (
    (email === undefined ||
      firstName === undefined ||
      lastName === undefined) &&
    req.body.accessToken !== undefined
  ) {
    try {
      logger.debug('Fetching additional user info from Google API');
      const data = await fetchGoogleUserInfo(req.body.accessToken);
      logger.debug(`Retrieved user info from Google: ${data.email}`);
      email = data.email;
      firstName = data.given_name || "User";
      lastName = data.family_name || "";
    } catch (err) {
      logger.error(`Error fetching Google user info: ${err.message}`);
      return res.status(401).send({ message: "Could not retrieve Google user profile." });
    }
  }

  if (!email) {
    logger.warn("Login failed: Google account email is missing");
    return res.status(400).send({ message: "Email is required for login." });
  }

  const assignedRole = determineRoleByEmail(email);

  let user = {};
  let session = {};

  logger.debug(`Looking up user by email: ${email}`);
  
  await User.findOne({
    where: {
      email: email,
    },
  })
    .then((data) => {
      if (data != null) {
        user = data.dataValues;
        logger.debug(`Existing user found: ${email}`);
      } else {
        // create a new User and save to database
        user = {
          fName: firstName,
          lName: lastName,
          email: email,
        };
        logger.debug(`New user to be created: ${email}`);
      }
    })
    .catch((err) => {
      logger.error(`Error finding user: ${err.message}`);
      res.status(500).send({ message: err.message });
    });

  if (res.headersSent) return;

  // this lets us get the user id
  if (user.id === undefined) {
    logger.info(`Creating new user: ${user.email}`);
    
    await User.create(user)
      .then((data) => {
        user = data.dataValues;
        logger.info(`User registered successfully: ${user.id} - ${user.email}`);
      })
      .catch((err) => {
        logger.error(`Error creating user: ${err.message}`);
        res.status(500).send({ message: err.message });
      });
  }

  if (res.headersSent) return;

  if (user.id !== undefined) {
    
    // doing this to ensure that the user's name is the one listed with Google
    user.fName = firstName;
    user.lName = lastName;
  
    await User.update(user, { where: { id: user.id } })
      .then((num) => {
        if (num == 1) {
          logger.info(`Updated user name: ${user.id}`);
        } else {
          logger.warn(`Cannot update user with id=${user.id}. User not found or empty body`);
        }
      })
      .catch((err) => {
        logger.error(`Error updating user ${user.id}: ${err.message}`);
      });
  }

  if (res.headersSent) return;

  // try to find session first
  logger.debug(`Looking for existing session for: ${email}`);

  await Session.findOne({
    where: {
      email: email,
      token: { [Op.ne]: "" },
    },
  })
    .then(async (data) => {
      if (data !== null) {
        session = data.dataValues;
        if (session.expirationDate < Date.now()) {
          logger.info(`Session expired for ${email}, clearing token`);
          session.token = "";
          // clear session's token if it's expired
          await Session.update(session, { where: { id: session.id } })
            .then((num) => {
              if (num == 1) {
                logger.info('Expired session cleared successfully');
              } else {
                logger.error('Failed to clear expired session');
                res.send({
                  message: `Error logging out user.`,
                });
                return;
              }
            })
            .catch((err) => {
              logger.error(`Error clearing expired session: ${err.message}`);
              res.status(500).send({
                message: "Error logging out user.",
              });
              return;
            });
          //reset session to be null since we need to make another one
          session = {};
        } else {
          // if the session is still valid, then send info to the front end
          let userInfo = {
            email: user.email,
            fName: user.fName,
            lName: user.lName,
            role: assignedRole,
            userId: user.id,
            token: session.token,
            // refresh_token: user.refresh_token,
            // expiration_date: user.expiration_date
          };
          logger.info(`Valid session found for ${email}, reusing existing session`);
          res.send(userInfo);
          return;
        }
      }
    })
    .catch((err) => {
      logger.error(`Error retrieving session: ${err.message}`);
      res.status(500).send({
        message:
          err.message || "Some error occurred while retrieving sessions.",
      });
    });

  if (res.headersSent) return;

  if (session.id === undefined) {
    // create a new Session with an expiration date and save to database
    logger.info(`Creating new session for ${email}`);
    let token = createSessionToken();
    let tempExpirationDate = new Date();
    tempExpirationDate.setDate(tempExpirationDate.getDate() + 1);
    const newSession = {
      token: token,
      email: email,
      userId: user.id,
      expirationDate: tempExpirationDate,
    };

    logger.debug(`Session created with expiration: ${tempExpirationDate}`);

    await Session.create(newSession)
      .then(() => {
        let userInfo = {
          email: user.email,
          fName: user.fName,
          lName: user.lName,
          role: assignedRole,
          userId: user.id,
          token: token,
          // refresh_token: user.refresh_token,
          // expiration_date: user.expiration_date
        };
        logger.info(`Login successful for user: ${user.email}`);
        res.send(userInfo);
      })
      .catch((err) => {
        logger.error(`Error creating session: ${err.message}`);
        res.status(500).send({ message: err.message });
      });
  }
};

exports.authorize = async (req, res) => {
  logger.info(`Authorization request for user: ${req.params.id}`);

  let tokens;
  try {
    logger.debug('Exchanging authorization code for tokens');
    tokens = await exchangeGoogleCodeForTokens(req.body.code);
  } catch (err) {
    logger.error(`Authorization code exchange failed: ${err.message}`);
    return res.status(401).send({ message: "Failed to authorize with Google." });
  }

  let user = {};
  logger.debug(`Finding user with id: ${req.params.id}`);

  await User.findOne({
    where: {
      id: req.params.id,
    },
  })
    .then((data) => {
      if (data != null) {
        user = data.dataValues;
        logger.debug(`User found for authorization: ${user.email}`);
      } else {
        logger.warn(`User not found for authorization: ${req.params.id}`);
        res.status(404).send({ 
          message: `User with id ${req.params.id} not found` 
        });
        return;
      }
    })
    .catch((err) => {
      logger.error(`Error finding user for authorization: ${err.message}`);
      res.status(500).send({ message: err.message });
      return;
    });

  // Check if user was found before continuing
  if (!user.id) {
    return; // User not found, response already sent
  }
  
  user.refresh_token = tokens.refresh_token || user.refresh_token;
  let tempExpirationDate = new Date();
  tempExpirationDate.setDate(tempExpirationDate.getDate() + 100);
  user.expiration_date = tempExpirationDate;

  await User.update(user, { where: { id: user.id } })
    .then((num) => {
      if (num == 1) {
        logger.info(`Updated Google OAuth tokens for user: ${user.id}`);
      } else {
        logger.warn(`Cannot update user ${user.id}. User not found or empty body`);
      }
      let userInfo = {
        refresh_token: user.refresh_token,
        expiration_date: user.expiration_date,
      };
      res.send(userInfo);
    })
    .catch((err) => {
      logger.error(`Error updating user tokens: ${err.message}`);
      res.status(500).send({ message: err.message });
      return
    });

  logger.debug('Authorization complete');
};

exports.logout = async (req, res) => {
  logger.info('Logout request received');
  
  if (req.body === null) {
    logger.warn('Logout attempt with null body');
    res.send({
      message: "User has already been successfully logged out!",
    });
    return;
  }

  // invalidate session -- delete token out of session table
  let session = {};

  logger.debug('Looking up session for logout');
  await Session.findAll({ where: { token: req.body.token } })
    .then((data) => {
      if (data[0] !== undefined) {
        session = data[0].dataValues;
        logger.debug(`Session found for logout: ${session.email}`);
      }
    })
    .catch((err) => {
      logger.error(`Error retrieving session for logout: ${err.message}`);
      res.status(500).send({
        message:
          err.message || "Some error occurred while retrieving sessions.",
      });
      return;
    });

  session.token = "";

  // session won't be null but the id will if no session was found
  if (session.id !== undefined) {
    Session.update(session, { where: { id: session.id } })
      .then((num) => {
        if (num == 1) {
          logger.info(`User logged out successfully: ${session.email}`);
          res.send({
            message: "User has been successfully logged out!",
          });
        } else {
          logger.error('Failed to clear session token');
          res.send({
            message: `Error logging out user.`,
          });
        }
      })
      .catch((err) => {
        logger.error(`Error during logout: ${err.message}`);
        res.status(500).send({
          message: "Error logging out user.",
        });
      });
  } else {
    logger.warn('Logout attempt for already logged out user');
    res.send({
      message: "User has already been successfully logged out!",
    });
  }
};
export default exports;
