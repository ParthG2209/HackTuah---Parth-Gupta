const TECH_ICONS_MAP = {
  // Languages
  "python": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg",
  "javascript": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg",
  "typescript": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg",
  "rust": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/rust/rust-original.svg",
  "go": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/go/go-original.svg",
  "c++": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/cplusplus/cplusplus-original.svg",
  "html/css": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/html5/html5-original.svg",
  "solidity": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/solidity/solidity-original.svg",
  
  // Frameworks
  "react": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg",
  "next.js": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nextjs/nextjs-original.svg",
  "fastapi": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/fastapi/fastapi-original.svg",
  "django": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/django/django-plain.svg",
  "node.js": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg",
  "express": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/express/express-original.svg",
  "svelte": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/svelte/svelte-original.svg",
  "flask": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/flask/flask-original.svg",
  
  // Databases
  "postgresql": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/postgresql/postgresql-original.svg",
  "supabase": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/supabase/supabase-original.svg",
  "mongodb": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mongodb/mongodb-original.svg",
  "redis": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/redis/redis-original.svg",
  "mysql": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mysql/mysql-original.svg",
  "dynamodb": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/dynamodb/dynamodb-original.svg",
  
  // AI/ML
  "pytorch": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/pytorch/pytorch-original.svg",
  "tensorflow": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/tensorflow/tensorflow-original.svg",
  "openai api": "https://cdn.simpleicons.org/openai/white",
  "hugging face": "https://cdn.simpleicons.org/huggingface",
  "langchain": "https://cdn.simpleicons.org/langchain",
  "gemini api": "https://cdn.simpleicons.org/googlegemini",
  
  // Tools
  "docker": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/docker/docker-original.svg",
  "kubernetes": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/kubernetes/kubernetes-plain.svg",
  "git": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/git/git-original.svg",
  "aws": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/amazonwebservices/amazonwebservices-original-wordmark.svg",
  "github actions": "https://cdn.simpleicons.org/githubactions",
  "vercel": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vercel/vercel-original.svg"
};

export const getTechIconUrl = (tech) => {
  const normalized = tech.toLowerCase().trim();
  if (TECH_ICONS_MAP[normalized]) {
    return TECH_ICONS_MAP[normalized];
  }
  // Fallback slug for simpleicons API
  const slug = normalized
    .replace(/\.js$/, 'dotjs')
    .replace(/\+/g, 'plus')
    .replace(/#/g, 'sharp')
    .replace(/[^a-z0-9]/g, '');
  return `https://cdn.simpleicons.org/${slug}`;
};
