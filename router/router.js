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
  console.log('['+req.method+'] ' + req.headers.host + req.url);

  
  
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
          "<h2>Oops</h2>Looks like there's some problems..."+
          " Feel free to give me a heads up at "+
          "<a href='mailto:errors@swagyolo.biz'>errors@swagyolo.biz</a>.");
});

process.on('uncaughtException', function(err) {
  //för att det blir lite dålig stäming om redirectservern ligger nere
  console.log("CRITICAL:", err);

  mail.send({
    subject: 'Error in router',
    recipient: 'router+error@mattiskan.se',
    body: '' + err
  });
});

router.listen(8080);
console.log("router started. Using host ip:", process.env.HOST_IP || '172.0.0.1')
