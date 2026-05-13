#!/usr/bin/env node
const SMTPServer = require('smtp-server').SMTPServer;
const simpleParser = require('mailparser').simpleParser;
const express = require("express");
const basicAuth = require('express-basic-auth');
const path = require("path");
const dayjs = require("dayjs");
const { program, Option } = require('commander');

program
  .name('fake-smtp-server')
  .helpOption('--help', 'display help')
  .option('-s, --smtp-port <number>', 'SMTP port to listen on', Number, 1025)
  .option('--smtp-ip <ip>', 'IP Address to bind SMTP service to', '0.0.0.0')
  .addOption(new Option('-h, --http-port <number>', 'HTTP port to listen on').argParser(Number).default(1080))
  .option('--http-ip <ip>', 'IP Address to bind HTTP service to', '0.0.0.0')
  .option('-w, --whitelist <emails>', 'Only accept e-mails from these addresses. Accepts multiple e-mails comma-separated')
  .option('-m, --max <number>', 'Max number of e-mails to keep', Number, 100)
  .option('-a, --auth <user:pass>', 'Enable Authentication')
  .option('--headers', 'Enable headers in responses')
  .parse();

const config = program.opts();

const whitelist = config.whitelist ? config.whitelist.split(',') : [];

let users = null;
if (config.auth && !/.+:.+/.test(config.auth)) {
  console.error("Please provide authentication details in USERNAME:PASSWORD format");
  process.exit(1);
}
if (config.auth) {
  let authConfig = config.auth.split(":");
  users = {};
  users[authConfig[0]] = authConfig[1];
}

const mails = [];

const server = new SMTPServer({
  authOptional: true,
  maxAllowedUnauthenticatedCommands: 1000,
  onMailFrom(address, session, cb) {
    if (whitelist.length == 0 || whitelist.indexOf(address.address) !== -1) {
      cb();
    } else {
      cb(new Error('Invalid email from: ' + address.address));
    }
  },
  onAuth(auth, session, callback) {
    console.log('SMTP login for user: ' + auth.username);
    callback(null, {
      user: auth.username
    });
  },
  onData(stream, session, callback) {
    parseEmail(stream).then(
      mail => {
        console.debug(JSON.stringify(mail, null, 2));

        mails.unshift(mail);

        //trim list of emails if necessary
        while (mails.length > config.max) {
          mails.pop();
        }

        callback();
      },
      callback
    );
  }
});

function formatHeaders(headers) {
  const result = {};
  for (const [key, value] of headers) {
    result[key] = value;
  }
  return result;
}

function parseEmail(stream) {
  return simpleParser(stream).then(email => {
    if (config.headers) {
      email.headers = formatHeaders(email.headers);
    } else {
      delete email.headers;
    }
    return email;
  });
}

server.on('error', err => {
  console.error(err);
});

server.listen(config.smtpPort, config.smtpIp);

const app = express();

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

if (users) {
    app.use(basicAuth({
        users: users,
        challenge: true
    }));
}

const buildDir = path.join(__dirname, 'build');

app.use(express.static(buildDir));

function emailFilter(filter) {
  return email => {
    if (filter.since || filter.until) {
      const date = dayjs(email.date);
      if (filter.since && date.isBefore(filter.since)) {
        return false;
      }
      if (filter.until && date.isAfter(filter.until)) {
        return false;
      }
    }

    if (filter.to && email.to.value.every(to => to.address !== filter.to)) {
      return false;
    }

    if (filter.from && email.from.value.every(from => from.address !== filter.from)) {
      return false;
    }

    return true;
  }
}

app.get('/api/emails', (req, res) => {
  res.json(mails.filter(emailFilter(req.query)));
});

app.delete('/api/emails', (req, res) => {
    mails.length = 0;
    res.send();
});

app.listen(config.httpPort, config.httpIp, () => {
  console.log("HTTP server listening on http://" + config.httpIp + ":" + config.httpPort);
});

console.log("SMTP server listening on " + config.smtpIp + ":" + config.smtpPort);
