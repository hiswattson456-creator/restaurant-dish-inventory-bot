module.exports = {
  apps: [
    {
      name: 'restaurant-bot',
      script: 'src/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env_production: {
        NODE_ENV: 'production',
      },
      error_file: '/var/log/pm2/restaurant-bot-error.log',
      out_file: '/var/log/pm2/restaurant-bot-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
