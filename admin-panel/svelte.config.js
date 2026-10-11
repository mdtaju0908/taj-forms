import adapter from '@sveltejs/adapter-static'

const config = {
  kit: {
    adapter: adapter({ fallback: '200.html', strict: false }),
    paths: { base: process.env.PUBLIC_BASE_PATH || '/forms' },
    prerender: { entries: [] }
  }
}
export default config
