// Azure Static Web App module

@description('Name of the Static Web App')
param name string

@description('Location for the Static Web App')
param location string

resource staticWebApp 'Microsoft.Web/staticSites@2022-09-01' = {
  name: name
  location: location
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    repositoryUrl: ''
    branch: ''
    buildProperties: {
      appLocation: '/src/app'
      apiLocation: ''
      outputLocation: 'dist'
    }
  }
}

output uri string = 'https://${staticWebApp.properties.defaultHostname}'
output name string = staticWebApp.name
