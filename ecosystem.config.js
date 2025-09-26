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
        PORT: 3000
      }
    },
    {
      name: 'ngrok-tunnel',
      script: 'cmd',
      args: '/c ngrok http 3000 --domain=foregoing-wilburn-healthily.ngrok-free.dev',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      interpreter: 'none',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/ngrok-error.log',
      out_file: './logs/ngrok-out.log',
      log_file: './logs/ngrok-combined.log'
    }
  ]
};