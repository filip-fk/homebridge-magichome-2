//
//  base.js
//  Sahil Chaddha
//
//  Created by Sahil Chaddha on 13/08/2018.
//  Copyright © 2018 sahilchaddha.com. All rights reserved.
//

const cp = require('child_process');
const lightAgent = require('../lib/lightAgent');

const Accessory = class {
  constructor(config, log, homebridge) {
    this.homebridge = homebridge;
    this.log = log;
    this.config = config;
    this.name = config.name;
    this.services = this.getAccessoryServices();
    this.services.push(this.getInformationService());
  }

  identify() {
    this.callback();
  }

  getInformationService() {
    const informationService = new this.homebridge.Service.AccessoryInformation();
    informationService
      .setCharacteristic(this.homebridge.Characteristic.Manufacturer, 'MagicHome')
      .setCharacteristic(this.homebridge.Characteristic.Model, this.getModelName())
      .setCharacteristic(this.homebridge.Characteristic.SerialNumber, this.getSerialNumber());
    return informationService;
  }

  executeCommand(address, command, callback) {
    const { exec } = cp;
    const self = this;
    const cmd = `/usr/bin/env flux_led ${lightAgent.getAddress(address)} ${command}`;
    if (self.homebridge.debug) {
      self.log(cmd);
    }
    exec(cmd, (err, stdOut) => {
      if (self.homebridge.debug) {
        self.log(stdOut);
      }
      if (callback) {
        callback(err, stdOut);
      }
    });
  }

  getServices() {
    return this.services;
  }
};

module.exports = Accessory;
