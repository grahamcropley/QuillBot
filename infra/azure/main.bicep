targetScope = 'resourceGroup'

param location string = resourceGroup().location
param appName string = 'quillbot'
param environmentName string = '${appName}-env'
param logAnalyticsName string = '${appName}-logs'
param acrName string
param storageAccountName string
param dataShareName string = 'quillbot-data'
param configShareName string = 'opencode-config'
param webImage string
param opencodeImage string
param opencodeApiKey string = ''
param minReplicas int = 0
param maxReplicas int = 1

// Entra ID (Azure AD) Authentication - Easy Auth
// Set these to enable Microsoft SSO
@description('Entra ID tenant ID for authentication (leave empty to disable auth)')
param entraIdTenantId string = ''

@description('Entra ID client ID (app registration) for authentication')
param entraIdClientId string = ''

@secure()
@description('Entra ID client secret for authentication')
param entraIdClientSecret string = ''

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: true
  }
}

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logAnalyticsName
  location: location
  properties: {
    retentionInDays: 30
  }
}

resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
  }
}

resource dataShare 'Microsoft.Storage/storageAccounts/fileServices/shares@2023-01-01' = {
  name: '${storage.name}/default/${dataShareName}'
}

resource configShare 'Microsoft.Storage/storageAccounts/fileServices/shares@2023-01-01' = {
  name: '${storage.name}/default/${configShareName}'
}

resource environment 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: environmentName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: listKeys(logAnalytics.id, '2020-08-01').primarySharedKey
      }
    }
  }
}

resource dataStorage 'Microsoft.App/managedEnvironments/storages@2023-05-01' = {
  name: '${environment.name}/data'
  properties: {
    azureFile: {
      accountName: storage.name
      accountKey: listKeys(storage.id, '2023-01-01').keys[0].value
      shareName: dataShareName
      accessMode: 'ReadWrite'
    }
  }
}

resource configStorage 'Microsoft.App/managedEnvironments/storages@2023-05-01' = {
  name: '${environment.name}/opencode-config'
  properties: {
    azureFile: {
      accountName: storage.name
      accountKey: listKeys(storage.id, '2023-01-01').keys[0].value
      shareName: configShareName
      accessMode: 'ReadWrite'
    }
  }
}

var acrCredentials = listCredentials(acr.id, '2023-07-01')

resource app 'Microsoft.App/containerApps@2023-05-01' = {
  name: appName
  location: location
  dependsOn: [
    dataStorage
    configStorage
  ]
  properties: {
    managedEnvironmentId: environment.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 3000
        transport: 'auto'
      }
      registries: [
        {
          server: acr.properties.loginServer
          username: acrCredentials.username
          passwordSecretRef: 'acr-password'
        }
      ]
      secrets: concat(
        [
          {
            name: 'acr-password'
            value: acrCredentials.passwords[0].value
          }
        ],
        opencodeApiKey != '' ? [
          {
            name: 'opencode-api-key'
            value: opencodeApiKey
          }
        ] : [],
        entraIdClientSecret != '' ? [
          {
            name: 'entra-client-secret'
            value: entraIdClientSecret
          }
        ] : []
      )
    }
    template: {
      containers: [
        {
          name: 'web'
          image: webImage
          env: concat(
            [
              {
                name: 'OPENCODE_API_URL'
                value: 'http://localhost:9090'
              }
            ],
            opencodeApiKey != '' ? [
              {
                name: 'OPENCODE_API_KEY'
                secretRef: 'opencode-api-key'
              }
            ] : []
          )
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          volumeMounts: [
            {
              volumeName: 'data'
              mountPath: '/app/data'
            }
          ]
        }
        {
          name: 'opencode'
          image: opencodeImage
          command: [
            'opencode'
            'serve'
            '--host'
            '0.0.0.0'
            '--port'
            '9090'
          ]
          env: concat(
            [
              {
                name: 'HOME'
                value: '/app'
              }
              {
                name: 'XDG_CONFIG_HOME'
                value: '/app/.config'
              }
            ],
            opencodeApiKey != '' ? [
              {
                name: 'OPENCODE_API_KEY'
                secretRef: 'opencode-api-key'
              }
            ] : []
          )
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          volumeMounts: [
            {
              volumeName: 'data'
              mountPath: '/app/data'
            }
            {
              volumeName: 'opencode-config'
              mountPath: '/app/.config/opencode'
            }
          ]
        }
      ]
      volumes: [
        {
          name: 'data'
          storageType: 'AzureFile'
          storageName: 'data'
        }
        {
          name: 'opencode-config'
          storageType: 'AzureFile'
          storageName: 'opencode-config'
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
      }
    }
  }
}

output webUrl string = 'https://${app.properties.configuration.ingress.fqdn}'

// Easy Auth configuration - Microsoft Entra ID
// Only created when entraIdTenantId is provided
resource authConfig 'Microsoft.App/containerApps/authConfigs@2023-05-01' = if (entraIdTenantId != '') {
  name: 'current'
  parent: app
  properties: {
    platform: {
      enabled: true
    }
    globalValidation: {
      unauthenticatedClientAction: 'RedirectToLoginPage'
      redirectToProvider: 'azureactivedirectory'
    }
    identityProviders: {
      azureActiveDirectory: {
        enabled: true
        registration: {
          clientId: entraIdClientId
          clientSecretSettingName: 'entra-client-secret'
          openIdIssuer: 'https://login.microsoftonline.com/${entraIdTenantId}/v2.0'
        }
        validation: {
          allowedAudiences: [
            'api://${entraIdClientId}'
          ]
          defaultAuthorizationPolicy: {
            allowedPrincipals: {}
          }
        }
        login: {
          loginParameters: [
            'scope=openid profile email'
          ]
        }
      }
    }
    login: {
      tokenStore: {
        enabled: true
      }
    }
  }
}
