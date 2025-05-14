PS C:\Projects\PetSystemTenant-fix-pet-form-save-and-modal>     npm run start:server

> petfacil-app@0.0.0 start:server
> node --env-file=.env src/server.js

[Startup] Attempting to connect to MongoDB at mongodb://168.75.101.234:27017/petfacil_app...
(node:21496) [MONGOOSE] Warning: Duplicate schema index on {"access_url":1} found. This is often due to declaring an index using both "index: 
true" and "schema.index()". Please remove the duplicate index definition.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:21496) [MONGOOSE] Warning: Duplicate schema index on {"admin_user_id":1} found. This is often due to declaring an index using both "index: true" and "schema.index()". Please remove the duplicate index definition.
[Startup] FATAL ERROR during server startup: MongooseServerSelectionError: connect ECONNREFUSED 168.75.101.234:27017
    at _handleConnectionErrors (C:\Projects\PetSystemTenant-fix-pet-form-save-and-modal\node_modules\mongoose\lib\connection.js:1165:11) 
    at NativeConnection.openUri (C:\Projects\PetSystemTenant-fix-pet-form-save-and-modal\node_modules\mongoose\lib\connection.js:1096:11)
    at async startServer (file:///C:/Projects/PetSystemTenant-fix-pet-form-save-and-modal/src/server.js:37:7) {
  errorLabelSet: Set(0) {},
  reason: TopologyDescription {
    type: 'Unknown',
    servers: Map(1) { '168.75.101.234:27017' => [ServerDescription] },
    stale: false,
    compatible: true,
    heartbeatFrequencyMS: 10000,
    localThresholdMS: 15,
    setName: null,
    maxElectionId: null,
    maxSetVersion: null,
    commonWireVersion: 0,
    logicalSessionTimeoutMinutes: null
  },
  code: undefined
}
npm notice
npm notice New major version of npm available! 10.9.2 -> 11.3.0
npm notice Changelog: https://github.com/npm/cli/releases/tag/v11.3.0
npm notice To update run: npm install -g npm@11.3.0
npm notice
PS C:\Projects\PetSystemTenant-fix-pet-form-save-and-modal> 