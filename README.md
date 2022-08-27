# Scanner

### Table of Contents
- [Description](#description)  
- [Related Projects](#related-projects)
- [How to Use the Scanner](#how-to-use-the-scanner)
    - [Install](#install)
    - [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)
<a name="headers"/>


## Description
Scanner is a bridge component responsible for observing and tracking the latest blocks in the target networks.

The goal of this project is to create an infrastructure for bigger projects. Other bridge services like watcher and guard use this component to track the needed information. Moreover, this library can be utilized in other projects rather than bridge-related services to make them independent of the ergo explorer. It would help the network to be as decentralised as possible.


While the scanner itself only tracks the latest target network blocks, you can register a data extractor to the scanner to save your required data. In Rosen bridge we use 4 different extractors above the scanner to extract bridge information. Check out these extractors here.

## Related Projects
As mentioned above data extractors can be added to the scanner to extract and store all required information. Finally these components are used in watcher and guard service.

## How to Use the Scanner

### Install
This project is written in node-js using Esnext module and typeorm database. As the scanner is an infrustructure package and it's not designed to be used independently. However, you can easly install and use this library in your projects by running:
```shell
npm i @rosen-bridge/scanner
```

Additionally, it is possible to build this project manually as well. In order to build the project, clone the scanner repo and  follow these steps:

```shell
npm install
npm run build
```

### Usage
Ergo Scanner:
```javascript
const ergoScannerConfig = {
    nodeUrl: ergoConfig.nodeUrl,
    timeout: ergoConfig.nodeTimeout,
    initialHeight: ergoConfig.ergoInitialHeight,
    dataSource: dataSource,
}
scanner = new ErgoScanner(ergoScannerConfig);
```

Cardano Scanner:
```javascript
const cardanoScannerConfig = {
    koiosUrl: cardanoConfig.koiosURL,
    timeout: cardanoConfig.timeout,
    initialHeight: cardanoConfig.initialHeight,
    dataSource: dataSource,
}
cardanoScanner = new CardanoKoiosScanner(cardanoScannerConfig)
```

Registering data extractor:
```javascript
const dataExtractor = new DataExtractor(dataSource, PARAMETERS)
scanner.registerExtractor(dataExtractor)
```

## Contributing
TBD

## License
TBD




