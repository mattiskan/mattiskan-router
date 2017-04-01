//var mail = require('mailgun-send');
var proxy = require('http-proxy').createProxy();
var fs = require('fs');
var tls = require('tls');
var http = require('http');
var https = require('https');

var config = JSON.parse(
  fs.readFileSync('router/config.json', 'utf-8').replace(/\$HOST/g, process.env.HOST_IP || '172.0.0.1')
);
//mail.config(config.mail);

function translate(requestedHostname){
  requestedHostname = (requestedHostname || '').toLowerCase();
  
  // e.g. "$somethig.my_url" : "$HOST:1234"
  for(regex in config.routes) {
    if(new RegExp(regex).test(requestedHostname)){
      return config.routes[regex];
    }
  }
  return 404;
};

var requestHandler = function(req, res) {
  var ip = req.headers['x-forwarded-for'] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      req.connection.socket.remoteAddress;
  
  console.log(ip + ' - ['+req.method+'] ' + req.headers.host + req.url);
  console.log('    ==> ' + translate(req.headers.host));

  if(translate(req.headers.host) === 404){
      write404(res);
      return
  }
      

  proxy.web(req, res, {
    target: translate(req.headers.host),
    xfwd: true, // pass clients ip as req.headers['x-forwarded-for']
    //ws: true, // forward websockets
  });
};

var errorFunction = function (err, req, res) {
  console.log(err);
  console.log();

  res.writeHead(500, {
    'Content-Type': 'text/html'
  });
  res.end("<img src='http://gifrific.com/wp-content/uploads/2012/07/blender-explode-home-improvement.gif'>"+
          "<h2>Oops</h2>Looks like there's some problems... "+
          "I have already been automatically notified, so there's nothing to do but to wait.");

  if(req.headers.host && req.headers.host.startsWith('stage'))
    return;
  if(err.code === 'ECONNRESET')
    return;
  
  /*console.log('sent email to ' + config.notificationEmail);
  mail.send({
    subject: 'Failing service: ' + req.headers.host,
    recipient: config.notificationEmail,
    body: '' + err
  }); */
};

var write404 = function(res) {
  res.writeHead(404, {'Content-Type': 'text/html'});
  res.end("<img src='https://media.giphy.com/media/E87jjnSCANThe/giphy.gif'>"+
          "<h2>404 — I can't find the page you're requesting.</h2>");
};

var secureContext = {
    'swagyolo.biz': {
	key: fs.readFileSync('router/certs/swagyolo.biz.key'),
	cert: fs.readFileSync('router/certs/swagyolo.biz.crt'),
    },
    'mattiskan.se': {
	key: fs.readFileSync('router/certs/mattiskan.se.key'),
	cert: fs.readFileSync('router/certs/mattiskan.se.crt'),
    },
};

var options = {
    key: fs.readFileSync('router/certs/swagyolo.biz.key'),
    cert: fs.readFileSync('router/certs/swagyolo.biz.crt'),
    SNICallback: function(domain, cb) {
        if (secureContext[domain]) {
            if (cb) {
                return cb(null, tls.createSecureContext(secureContext[domain]));
            } else {
                // compatibility for older versions of node
                return secureContext[domain]; 
            }
        } else {
            throw new Error('No keys/certificates for domain requested');
        }
    },
};


var router = http.createServer(requestHandler);
var secureRouter = https.createServer(options, requestHandler);

proxy.on('error', errorFunction);
router.on('error', errorFunction);
secureRouter.on('error', errorFunction);

process.on('uncaughtException', function(err) {
  //för att det blir lite dålig stäming om redirectservern ligger nere
  console.log("unrecoverable:", err);
  
  /* mail.send({
    subject: 'UncaughtException in router',
    recipient: config.notificationAddress,
    body: '' + err
  }); */
});

process.on('SIGTERM', function(){
  console.log('stopping router...');
  router.close(function() {
    console.log('router stopped');
    process.exit();
  });
});

router.listen(8080, function() {
  console.log("router started. Using host ip:", process.env.HOST_IP || '172.0.0.1')
});
secureRouter.listen(8081, function() {
  console.log("secure router started. Using host ip:", process.env.HOST_IP || '172.0.0.1')
});
