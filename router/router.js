var mail = require('mailgun-send');
var proxy = require('http-proxy').createProxy();
var fs = require('fs');

var config = JSON.parse(
  fs.readFileSync('router/config.json', 'utf-8').replace(/\$HOST/g, process.env.HOST_IP || '172.0.0.1')
);
mail.config(config.mail);

function translate(requestedHostname){
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
    target: translate(req.headers.host)
  });
});

proxy.on('error', function (err, req, res) {
  console.log(err);
  console.log();
  
  res.writeHead(500, {
    'Content-Type': 'text/html'
  });
  res.end("<img src='http://i.imgur.com/VD0EDRD.gif'>"+
          "<h2>Oops</h2>Looks like there's some problems... "+
          "I have already been notified, but feel free to ping me at: "+
          "<a href='mailto:errors@swagyolo.biz'>errors@swagyolo.biz</a>.");

    mail.send({
      subject: 'Failing service: ' + req.headers.host,
      recipient: 'router+error@mattiskan.se',
      body: '' + err
    });
});

process.on('uncaughtException', function(err) {
  //för att det blir lite dålig stäming om redirectservern ligger nere
  console.log("CRITICAL:", err);

  mail.send({
    subject: 'CRITICAL: UncaughtException in router',
    recipient: 'router+error@mattiskan.se',
    body: '' + err
  });
});

router.listen(8080);
console.log("router started. Using host ip:", process.env.HOST_IP || '172.0.0.1')
