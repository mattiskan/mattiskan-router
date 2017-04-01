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

var uncaughtErrorFunction = function (err, req, res) {
  console.log(err);
  console.log();

    write500(res);

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

var insecureRequestHandler = function(req, res) {
    try {
	readCert(req.headers.host);
	// didn't raise, so there's a cert for this domain. Let's redirect to https.
	console.log('certificate found for '+req.headers.host+'. Redirecting to https://')
	res.writeHead(301, { "Location": "https://" + req.headers.host + req.url });
	res.end();
    } catch(err){
	console.log('no redirect because', err);
	requestHandler(req, res);
    }
};


var write404 = function(res) {
  res.writeHead(404, {'Content-Type': 'text/html'});
  fs.readFile('router/templates/404.html', 'utf8', function(err, content) {
      res.end(content);
  });
};

var write500 = function(res) {
  res.writeHead(500, {'Content-Type': 'text/html'});
  fs.readFile('router/templates/500.html', 'utf8', function(err, content) {
      res.end(content);
  });
};

var readCert = function(domain) {
    try {
	return tls.createSecureContext({
	    key: fs.readFileSync('router/certs/' + domain + '.key'),
	    cert: fs.readFileSync('router/certs/'+ domain + '.crt'),		
	});
    } catch(err) {
	throw new Error('Found no matching certificate for domain ' + domain);
    }
};

var options = {
    key: fs.readFileSync('router/certs/swagyolo.biz.key'),
    cert: fs.readFileSync('router/certs/swagyolo.biz.crt'),
    SNICallback: function(domain, cb) { // dynamically map domain to the right cert
	cb(null, readCert(domain));
    },
};


var router = http.createServer(insecureRequestHandler);
var secureRouter = https.createServer(options, requestHandler);

proxy.on('error', uncaughtErrorFunction);
router.on('error', uncaughtErrorFunction);
secureRouter.on('error', uncaughtErrorFunction);

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
