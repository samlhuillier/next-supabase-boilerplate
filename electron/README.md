# Electron System Audio Capture & Recording for MacOS
Hey 👋! Luke/YAE here - I just wanted to give another huge props to Sebastian for helping me to make this, for a little context this project came about through my own frustrations at the Electron documentation not supporting a clean MacOS experience for system audio capture [documentation found here](https://www.electronjs.org/docs/latest/api/desktop-capturer#caveats). And as a result I set about to create a clean way to do so - the requirements being: 

1. No user setup except for what they'll be used to ex. permissions
2. It couldn't feel too far from a native experience

I created an original prototype of what this would look like, but for the life of me I couldn't get the Swift code working - that's where Sebastian came in to take over from me after many chats. Sebastian was compensated for his work on this project, and we mutually agreed that it should be fully open source and not backed by any corporate sponsors (please do not reach out for that). And I'm proud to say, he's smashed it out of the park - far beyond what I was expecting of him!

As a side note - he's open to work, reach out to him here: https://www.linkedin.com/in/sebastian-w%C4%85sik-b23840174/ I highly recommend him! 

The project is available under the MIT license, however, you're unlikely to get any support - you can definetly reach out and I'll do my best but we're both busy people and the point of this project was to encourage the adoption and pushing of Electron.

## Setup

### Prerequisites
1. Node.js and npm installed
2. Supabase project (for authentication)
3. A web application that handles authentication (see Authentication section)

### Installation
1. Clone the repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and fill in your configuration:
   ```
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   WEB_APP_URL=https://your-webapp.com
   ```
4. Build the project: `npm run build && npm run build:electron`
5. Start the app: `npm run electron:start`

### Authentication Integration

This app now supports authentication through your web application using deep linking. The authentication flow works as follows:

1. User clicks "Sign In" in the Electron app
2. Opens your web app at `${WEB_APP_URL}/auth/login?desktop=true`
3. User completes authentication in the browser
4. Your web app generates a magic link and redirects to `maurice://auth?hashed_token=${hashed_token}`
5. Electron app receives the deep link and verifies the token with Supabase
6. User is signed in and can use the audio recorder

#### Required Web App Changes
Your web application should handle the `desktop=true` parameter and redirect to the Electron app after successful authentication:

```javascript
// In your web app after successful login
const { data: magicLink, error } = await supabaseAdmin.auth.admin.generateLink({
  type: 'magiclink',
  email: user.email
});

const hashed_token = magicLink.properties?.hashed_token;
return NextResponse.redirect(`maurice://auth?hashed_token=${hashed_token}`);
```

The protocol `maurice://` is registered when the Electron app starts.

Tags:
MacOS System Audio Capture Electron
