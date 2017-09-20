import chromedriver from 'chromedriver';
import webdriver from 'selenium-webdriver';
import electronPath from 'electron';

import {expect} from 'chai';

import fs from 'fs';
import fsExtra from 'fs-extra';
import path from 'path';

import * as settings from '../backend/settings.js';
import {createStoragePath} from '../backend/utils/homeFiles';

// Utils
const delay = time => new Promise(resolve => setTimeout(resolve, time));

// Initialize credentials
clearConnectorFolder();
saveCredentials();
console.log("@@@0",
    settings.getSetting('STORAGE_PATH'),
    fs.readFileSync(settings.getSetting('SETTINGS_PATH')).toString()
);

// Start chromedriver
console.log("@@@1");
chromedriver.start();
process.on('exit', chromedriver.stop);

describe('plotly database connector', function() {
    this.timeout(10 * 60 * 1000);

    before(() => {
        console.log("@@@2");
        return delay(3 * 1000).then(() => {
            console.log("@@@3");

            // Start electron app
            this.driver = new webdriver.Builder()
                .usingServer('http://localhost:9515')
                .withCapabilities({
                    chromeOptions: {
                        binary: electronPath,
                        args: [`app=${path.resolve()}`],
                    }
                })
                .forBrowser('electron')
                .build();

            return delay(3 * 1000)
                .then(() => console.log("@@@4"))
                .then(() => this.driver.getTitle())
                .then((title) => console.log("@@@5", title))
                .then(() => this.driver.wait(webdriver.until.titleIs('Plotly Database Connector v2.1.1'), 1 * 1000))
                .then(() => this.driver.getTitle())
                .then((title) => console.log("@@@6", title));
        });
    });

    after(() => {
        chromedriver.stop();

        console.log("@@@@@@");
        if (this.driver) {
            return delay(1 * 1000)
                .then(() => this.driver.quit());
        }
    });

    it('should create an SSL certificate', () => {
        console.log("@0");

        let chain = delay(1 * 1000);

        // Fill out SQL Credentials
        [
            ['test-input-username', 'masteruser'],
            ['test-input-host', 'readonly-test-mysql.cwwxgcilxwxw.us-west-2.rds.amazonaws.com'],
            ['test-input-port', '3306'],
            ['test-input-password', 'connecttoplotly'],
            ['test-input-database', 'plotly_datasets']
        ].forEach(([id, keys]) => {
            chain = chain
                .then(() => console.log("@1", id, keys))
                .then(() => this.driver.findElement(webdriver.By.id(id)).sendKeys(keys));
        });

        return chain
            // Connect
            .then(() => this.driver.findElement(webdriver.By.id('test-connect-button')).click())

            // Wait for certificate to be initialized - could take several minutes
            .then(() => this.driver.findElement(webdriver.By.className('test-ssl-tab')).click())

            .then(() => new Promise((resolve) => {
                const waitUntilInitialized = () => {
                    const isInitialized = this.driver.findElement(webdriver.By.id('test-ssl-initialized'));
                    console.log("@2", !!isInitialized);

                    if (isInitialized) resolve();
                    else setTimeout(waitUntilInitialized, 1000);
                };

                waitUntilInitialized();
                })
            );
    });
});

function saveCredentials() {
    const usersValue = JSON.stringify([{
        'username': 'plotly-database-connector',
        'accessToken': '2MiYq1Oive6RRjC6y9D4u7DjlXSs7k'
    }]);
    if (!fs.existsSync(settings.getSetting('STORAGE_PATH'))) {
        createStoragePath();
    }
    fs.writeFileSync(
        settings.getSetting('SETTINGS_PATH'),
        `USERS: ${usersValue}`
    );
}

function clearConnectorFolder() {
    try {
        fsExtra.removeSync(settings.getSetting('STORAGE_PATH'));
    } catch (e) {
        console.warn(e);
    }
}
