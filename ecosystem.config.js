module.exports = {
  apps: [
    {
      name: 'tasktrek-api',
      script: './dist/index.js',
      cwd: './apps/api',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      error_file: '/home/ubuntu/TaskTrek/logs/api-error.log',
      out_file: '/home/ubuntu/TaskTrek/logs/api-out.log',
      log_file: '/home/ubuntu/TaskTrek/logs/api-combined.log',
      time: true,
      max_restarts: 3,
      restart_delay: 1000,
      max_memory_restart: '200M', // Restart if memory usage exceeds 200MB
    },
    {
      name: 'tasktrek-web',
      script: 'npm',
      args: 'start',
      cwd: './apps/web',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: '/home/ubuntu/TaskTrek/logs/web-error.log',
      out_file: '/home/ubuntu/TaskTrek/logs/web-out.log',
      log_file: '/home/ubuntu/TaskTrek/logs/web-combined.log',
      time: true,
      max_restarts: 3,
      restart_delay: 1000,
      max_memory_restart: '300M', // Restart if memory usage exceeds 300MB
    },
  ],
};
