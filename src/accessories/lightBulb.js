//
//  clearDirSwitch.js
//  Sahil Chaddha
//
//  Created by Sahil Chaddha on 26/08/2018.
//  Copyright © 2018 sahilchaddha.com. All rights reserved.
//

const convert = require('color-convert');
const Accessory = require('./base');

const LightBulb = class extends Accessory {
  constructor(config, log, homebridge) {
    super(config, log, homebridge);
    this.name = config.name || 'LED Controller';
    this.ip = config.ip;
    this.setup = config.setup || 'RGBW';
    this.color = { H: 0, S: 0, L: 100 };
    this.cTemp = 0;
    this.purewhite = config.purewhite || true;
    this.snum = config.ip || '1';
    this.timeout = config.timeout != null ? config.timeout : 60000;
    setTimeout(() => {
      this.updateState();
    }, 3000);
  }

  getAccessoryServices() {
    const lightbulbService = new this.homebridge.Service.Lightbulb(this.name);

    lightbulbService
      .getCharacteristic(this.homebridge.Characteristic.On)
      .on('get', this.getPowerState.bind(this))
      .on('set', this.setPowerState.bind(this));

    lightbulbService
      .addCharacteristic(new this.homebridge.Characteristic.Hue())
      .on('get', this.getHue.bind(this))
      .on('set', this.setHue.bind(this));

    lightbulbService
      .addCharacteristic(new this.homebridge.Characteristic.Saturation())
      .on('get', this.getSaturation.bind(this))
      .on('set', this.setSaturation.bind(this));

    lightbulbService
      .addCharacteristic(new this.homebridge.Characteristic.Brightness())
      .on('get', this.getBrightness.bind(this))
      .on('set', this.setBrightness.bind(this));

    lightbulbService
      .addCharacteristic(new this.homebridge.Characteristic.ColorTemperature())
      .on('get', this.getTemperature.bind(this))
      .on('set', this.setTemperature.bind(this));

    return [lightbulbService];
  }

  sendCommand(command, callback) {
    this.executeCommand(this.ip, command, callback);
  }

  getModelName() {
    return 'Light Bulb';
  }

  setSerialNumber(str) {
    return str;
  }

  getSerialNumber(){
    return this.snum;
  }

  logMessage(...args) {
    if (this.config.debug) {
      this.log(args);
    }
  }

  startTimer() {
    if (this.timeout === 0) return;
    setTimeout(() => {
      this.updateState();
    }, this.timeout);
  }

  updateState() {
    const self = this;
    this.logMessage('Polling Light', this.ip);
    self.getState((settings) => {
      self.isOn = settings.on;
      self.color = settings.color;
      self.cTemp = settings.temp;
      self.snum = settings.snum;
      self.logMessage('Updating Device', self.ip, self.color, self.isOn);
      self.services[0]
        .getCharacteristic(this.homebridge.Characteristic.On)
        .updateValue(self.isOn);
      self.services[0]
        .getCharacteristic(this.homebridge.Characteristic.Hue)
        .updateValue(self.color.H);
      self.services[0]
        .getCharacteristic(this.homebridge.Characteristic.Saturation)
        .updateValue(self.color.S);
      self.services[0]
        .getCharacteristic(this.homebridge.Characteristic.Brightness)
        .updateValue(self.color.L);
      self.services[0]
        .getCharacteristic(this.homebridge.Characteristic.ColorTemperature)
        .updateValue(self.cTemp);
      this.startTimer();
    });
  }

  getState(callback) {
    this.sendCommand('-i', (error, stdout) => {
      const settings = {
        on: false,
        color: { H: 0, S: 0, L: 50 },
        temp: 0
      };
      const snum = stdout.match(/^[A-Za-z0-9]+/g);
      const colors = stdout.match(/Color:\s*\(\d+,\s*\d+,\s*\d+\)/g);
      const temp = stdout.match(/CCT: (\d+)/g);
      const bright = stdout.match(/Brightness: \s*(\d+)/g);
      const isOn = stdout.match(/\] ON /g);
      if (snum && snum.length > 0)
      {
        settings.snum = snum;
      }
      if (isOn && isOn.length > 0) {
        settings.on = true;
      }
      if (colors && colors.length > 0) {
        // Remove last char )
        let str = colors.toString().substring(0, colors.toString().length - 1);
        // Remove First Char (
        str = str.substring(8, str.length);
        const rgbColors = str.split(', ').map((item) => item.trim());
        const converted = convert.rgb.hsv(rgbColors);
        settings.color = {
          H: converted[0],
          S: converted[1],
          L: converted[2],
        };
        settings.temp = 0;
      }
      else if(temp && temp.length > 0)
      {
        let str = temp.toString().substring(5, temp.toString().length);
        // Remove First Char (
        str = str.substring(8, str.length);
        let temperature = 1000000/temp;
        const converted = temperature < 200 ? [200, 90, 90]:[45, 90, 65]; //blue
        settings.color = {
          H: converted[0],
          S: converted[1],
          L: converted[2],
        };
        settings.temp = temperature;
      }

      callback(settings);
    });
  }

  getPowerState(callback) {
    callback(null, this.isOn);
  }

  setPowerState(value, callback) {
    const self = this;
    this.sendCommand(value ? '--on' : '--off', () => {
      self.isOn = value;
      callback();
    });
  }

  getHue(callback) {
    callback(null, this.color.H);
  }

  setHue(value, callback) {
    this.color.H = value;
    this.setToCurrentColor();
    callback();
  }

  getBrightness(callback) {
    callback(null, this.color.L);
  }

  setBrightness(value, callback) {
    this.color.L = value;
    this.setToCurrentColor();
    callback();
  }

  getSaturation(callback) {
    callback(null, this.color.S);
  }

  setSaturation(value, callback) {
    this.color.S = value;
    this.setToCurrentColor();
    callback();
  }

  getTemperature(callback){
    callback(null,this.cTemp);
  }

  setTemperature(value, callback){
    this.cTemp = value;
    this.setToWarmWhite();
    callback();
  }

  setToWarmWhite() {
    if(this.cTemp>200)
      this.sendCommand('--warmlight 100'); //+ `${this.color.L}//2.55`);
    else
      this.sendCommand('--coldlight 100'); //+ `${this.color.L}//2.55`);
  }

  setToCurrentColor() {
    const { color } = this;
    if (this.cTemp != 0) {
      this.setToWarmWhite();
      return;
    }

    const converted = convert.hsv.rgb([color.H, color.S, color.L]);
    this.logMessage('Setting New Color From ', this.ip, color, converted);
    const base = `-c `;
    this.sendCommand(`${base + converted[0]},${converted[1]},${converted[2]}`);
  }
};

module.exports = LightBulb;
