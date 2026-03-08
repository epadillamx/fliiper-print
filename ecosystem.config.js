module.exports = {
  apps: [
    {
      name: 'app',
      script: './server.js',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 443,
        SSL_CERT: 'C:/ssl-certs/impresora.local+2.pem',
        SSL_KEY:  'C:/ssl-certs/impresora.local+2-key.pem'
      }
    }
  ]
};