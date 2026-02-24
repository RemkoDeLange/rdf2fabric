// Azure Static Web App infrastructure for RDF2Fabric
// Deploy with: azd up

targetScope = 'subscription'

@description('Name of the environment (e.g., dev, test, prod)')
param environmentName string

@description('Primary location for resources')
param location string

// Resource group
resource rg 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: 'rg-${environmentName}'
  location: location
}

// Static Web App
module staticWebApp 'modules/staticwebapp.bicep' = {
  name: 'staticWebApp'
  scope: rg
  params: {
    name: 'swa-rdf-translator-${environmentName}'
    location: location
  }
}

// Outputs for azd
output AZURE_LOCATION string = location
output SERVICE_WEB_URI string = staticWebApp.outputs.uri
