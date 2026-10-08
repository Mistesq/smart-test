// The browser resolves relative URLs against the page origin; Node fetch (tests) needs an absolute one.
export const API_BASE_URL = import.meta.env.MODE === 'test' ? 'http://localhost' : ''
