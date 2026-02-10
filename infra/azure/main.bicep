targetScope = 'resourceGroup'

param location string = resourceGroup().location
param appName string = 'quillbot'
param environmentName string = '${appName}-env'
param logAnalyticsName string = '${appName}-logs'
param deployApp bool = true
param acrName string
param storageAccountName string
param dataShareName string = 'quillbot-data'
param configShareName string = 'opencode-config'
param webImage string = ''
param opencodeImage string = ''
param opencodeApiKey string = ''
param azureApiKey string = ''
param azureResourceName string = ''
param configRevision string = ''
param minReplicas int = 0
param maxReplicas int = 1

// NOTE: Authentication is configured via Azure Portal (Easy Auth)
// Container Apps > Authentication > Add identity provider > Microsoft
// This keeps auth config separate from IaC and avoids secret management

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

resource app 'Microsoft.App/containerApps@2023-05-01' = if (deployApp) {
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
        azureApiKey != '' ? [
          {
            name: 'azure-api-key'
            value: azureApiKey
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
              {
                name: 'CONFIG_REV'
                value: configRevision
              }
              {
                name: 'AZURE_RESOURCE_NAME'
                value: azureResourceName
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
            '--hostname'
            '0.0.0.0'
            '--port'
            '9090'
            '--print-logs'
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
               {
                 name: 'CONFIG_REV'
                 value: configRevision
               }
               {
                 name: 'AZURE_RESOURCE_NAME'
                 value: azureResourceName
               }
               {
                 name: 'OPENCODE_ENABLE_EXA'
                 value: '1'
               }
             ],
            opencodeApiKey != '' ? [
              {
                name: 'OPENCODE_API_KEY'
                secretRef: 'opencode-api-key'
              }
            ] : [],
            azureApiKey != '' ? [
              {
                name: 'AZURE_API_KEY'
                secretRef: 'azure-api-key'
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
