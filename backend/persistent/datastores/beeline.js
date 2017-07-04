import {exec} from 'child_process';

import csvParse from 'csv-parse';
import {dissoc, pluck} from 'ramda';

import Logger from '../../logger';
import {parseSQL} from '../../parse';


function beeline(query, connection) {
    const {url, username, password} = connection;

    // [TODO] [SECURITY]
    const cmd = 'beeline --silent --outputformat=csv2';

    return new Promise(function(resolve, reject) {
        const child = exec(cmd, function(err, stdout, stderr) {
            if (err) {
                reject(err);
                return;
            }

            // remove first empty line and last `\n`
            let result = stdout.toString().trim();

            // remove first three lines
            let start = 1 + result.indexOf('\n');
            start = 1 + result.indexOf('\n', start);
            start = 1 + result.indexOf('\n', start);
            result = result.substring(start);

            // remove last line
            let end = result.lastIndexOf('\n');
            result = result.substring(0, end);  // end = -1 is treated as 0

            resolve(result);
        });

        child.stdin.write(`!connect ${url}\n${username}\n${password}\n`);
        child.stdin.write(`${query}\n!quit\n`);
    });
}

function parse(stdout) {
    return new Promise((resolve, reject) => {
        csvParse(stdout, {
            quote: '\0',
        }, function(err, result) {
            if (err) reject(err);
            else {
                const columnnames = result[0];
                const rows = result.slice(1);
                resolve({columnnames, rows});
            }
        });
    });
}

export function connect(connection) {
    Logger.log('' +
        'Attempting to authenticate with connection ' +
        `${JSON.stringify(dissoc('password', connection), null, 2)} ` +
        '(password omitted)'
    );

    return beeline('', connection);
}

export function query(query, connection) {
    return beeline(query, connection)
        .then(parse);
}

export function tables(connection) {
    return beeline('show tables;', connection)
        .then(parse)
        .then(function({columnnames, rows}) {
            const index = columnnames.indexOf('tableName');
            const tables = (index === -1) ? [] : rows.map(row => row[index]);
            return tables.sort();
        });
}
