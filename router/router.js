var mail = require('mailgun-send');
var proxy = require('http-proxy').createProxy();
var fs = require('fs');

var config = JSON.parse(
  fs.readFileSync('router/config.json', 'utf-8').replace(/\$HOST/g, process.env.HOST_IP || '172.0.0.1')
);
mail.config(config.mail);

function translate(requestedHostname){
  requestedHostname = (requestedHostname || '').toLowerCase();
  
  for(regex in config.routes) {
    if(new RegExp(regex).test(requestedHostname)){
      return config.routes[regex];
    }
  }

  throw new Error("Unmatched domain: " + requestedHostname);
};

var router = require('http').createServer(function(req, res) {
  var ip = req.headers['x-forwarded-for'] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      req.connection.socket.remoteAddress;
  
  console.log(ip + ' - ['+req.method+'] ' + req.headers.host + req.url);

  proxy.web(req, res, {
    target: translate(req.headers.host),
    xfwd: true, // pass clients ip as req.headers['x-forwarded-for']
    ws: true, // forward websockets
  });
});

var errorFunction = function (err, req, res) {
  console.log(err);
  console.log();
  
  res.writeHead(500, {
    'Content-Type': 'text/html'
  });
  res.end("<img src='http://i.imgur.com/VD0EDRD.gif'>"+
          "<h2>Oops</h2>Looks like there's some problems... "+
          "I have already been notified, but feel free to ping me at: "+
          "<a href='mailto:errors@swagyolo.biz'>errors@swagyolo.biz</a>.");

  if(!req.headers.host.startsWith('stage')){
    mail.send({
      subject: 'Failing service: ' + req.headers.host,
      recipient: config.notificationAddress,
      body: '' + err
    });
  }
};

proxy.on('error', errorFunction);
router.on('error', errorFunction);

process.on('uncaughtException', function(err) {
  //för att det blir lite dålig stäming om redirectservern ligger nere
  console.log("CRITICAL:", err);

  mail.send({
    subject: 'CRITICAL: UncaughtException in router',
    recipient: config.notificationAddress,
    body: '' + err
  });
});

process.on('SIGTERM', function(){
  console.log('stopping router...');
  router.close(function() {
    console.log('router stopped');
    process.exit();
  });
});


router.listen(8080);
console.log("router started. Using host ip:", process.env.HOST_IP || '172.0.0.1')
