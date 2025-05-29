module.exports = {
  apps: [
    {
      name: 'telegrampro-web',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      error_file: './logs/web-error.log',
      out_file: './logs/web-out.log',
      log_file: './logs/web-combined.log',
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '1G',
      watch: false,
      ignore_watch: ['node_modules', 'logs', '.git'],
    },
    {
      name: 'telegrampro-admin-bot',
      script: 'node',
      args: '-e "require(\'./dist/bots/admin.js\'); require(\'./bots/admin.js\').startAdminBot();"',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/admin-bot-error.log',
      out_file: './logs/admin-bot-out.log',
      log_file: './logs/admin-bot-combined.log',
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 5000,
      watch: false,
    },
    {
      name: 'telegrampro-user-bot',
      script: 'node',
      args: '-e "require(\'./dist/bots/user.js\'); require(\'./bots/user.js\').startUserBot();"',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/user-bot-error.log',
      out_file: './logs/user-bot-out.log',
      log_file: './logs/user-bot-combined.log',
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 5000,
      watch: false,
    },
    {
      name: 'telegrampro-cron',
      script: 'node',
      args: '-e "require(\'./dist/cron/jobs.js\');"',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/cron-error.log',
      out_file: './logs/cron-out.log',
      log_file: './logs/cron-combined.log',
      time: true,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '30s',
      restart_delay: 10000,
      watch: false,
      cron_restart: '0 0 * * *', // Restart daily at midnight
    }
  ],

  // Deployment configuration
  deploy: {
    production: {
      user: 'deploy',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:yourusername/telegrampro.git',
      path: '/var/www/telegrampro',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build && npm run db:push && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    },
    staging: {
      user: 'deploy',
      host: 'staging-server.com',
      ref: 'origin/develop',
      repo: 'git@github.com:yourusername/telegrampro.git',
      path: '/var/www/telegrampro-staging',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build && npm run db:push && pm2 reload ecosystem.config.js --env staging',
      'pre-setup': ''
    }
  }
};
