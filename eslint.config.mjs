import nextConfig from 'eslint-config-next';

const ignores = [
  'node_modules',
  'node_modules_root',
  '.next',
  'backend/_video_temp/**/*',
  'backend/_video_temp',
  'backend/__pycache__',
  'venv',
];

const extendedNextConfig = nextConfig.map((config) => {
  if (config?.name === 'next') {
    return {
      ...config,
      rules: {
        ...config.rules,
        'react/jsx-curly-brace-presence': [
          'warn',
          { props: 'never', children: 'never', propElementValues: 'always' },
        ],
        '@next/next/no-img-element': 'off',
      },
    };
  }
  return config;
});

const config = [
  {
    ignores,
  },
  ...extendedNextConfig,
];

export default config;
