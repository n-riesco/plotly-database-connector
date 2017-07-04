import {exec} from 'child_process';

import csvParse from 'csv-parse';
import {dissoc, pluck} from 'ramda';

import Logger from '../../logger';
import {parseSQL} from '../../parse';


function beeline(query, connection) {
    const {url, username, password} = connection;

    // [TODO] [SECURITY]
    const cmd = `beeline --outputformat=csv2 -u "${url}" -n "${username}" -p "${password}" -e "${query}"`;

    return new Promise(function(resolve, reject) {
        exec(cmd, function(err, stdout, stderr) {
            if (err) reject(err);
            else resolve(stdout);
        });
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

    return beeline('!quit', connection);
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
