# Azure DevOps Release Work Item Tree



## Dependencies

The repository depends on a few Azure DevOps packages:

- [azure-devops-extension-sdk](https://github.com/Microsoft/azure-devops-extension-sdk): Required module for Azure DevOps extensions which allows communication between the host page and the extension iframe.
- [azure-devops-extension-api](https://github.com/Microsoft/azure-devops-extension-api): Contains REST client libraries for the various Azure DevOps feature areas.
- [azure-devops-ui](https://developer.microsoft.com/azure-devops): UI library containing the React components used in the Azure DevOps web UI.

Some external dependencies:
- `React` - Is used to render the UI in the samples, and is a dependency of `azure-devops-ui`.
- `TypeScript` - Samples are written in TypeScript and complied to JavaScript
- `SASS` - Extension samples are styled using SASS (which is compiled to CSS and delivered in webpack js bundles).
- `webpack` - Is used to gather dependencies into a single javascript bundle for each sample.

## Test the extension local

During development and debug, it can be usefull to load the extension from your dev machine rather than bundle all the code and deploy it through the marketplace. [I've used this setup to do this](https://github.com/microsoft/azure-devops-extension-hot-reload-and-debug).

You can run a development build with: 
    
    npm run build:dev

Make sure to add a PAT for publishing:

    "publish-extension:dev": "tfx extension publish --manifest-globs azure-devops-extension.json src/**/*.json --overrides-file configs/release.json --token $TOKEN --rev-version"

## Building the project

Just run:

    npm run build

This produces a .vsix file which can be uploaded to the [Visual Studio Marketplace](https://marketplace.visualstudio.com/azuredevops)

## Hub

This extension adds a hub named "Work Item Tree" into the release pipeline environment. 

The hub uses a Pivot component to draw 4 different tabs:
1. An `Overview` tab contains some simple details about the current user and project
2. A `Navigation` tab contains a few actions that allow you to integrate with the page's URL and title
3. An `Extension Data` tab demonstrates reading and writing to the extension data service
4. A `Messages` tab shows how to display global messages

There are also actions at the top-right of the hub which demonstrate opening dialogs and panels, including custom content within them (used in the `Panel` sample).