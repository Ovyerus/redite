function promisify(func, thisArg) {
    return function(...args) {
        return new Promise((resolve, reject) => {
            func.apply(thisArg, [...args, (err, ...res) => {
                if (err) reject(err);
                else if (res.length <= 1) resolve(res[0]);
                else resolve(res);
            }]);
        });
    };
}

const DB = 15;
const TestVal = 'test';
const TestHash = {TestHash: TestVal};
const TestList = [TestVal];
const DeepHash = {bar: {baz: {foobar: TestHash}}};

const Tests = [
    ['value', TestVal],
    ['object', TestHash],
    ['array', TestList]
];

const FinderDouble = [TestVal, TestVal];
const Finder = [...FinderDouble, 'find me', ...FinderDouble];
const Finder2 = [...FinderDouble, 'find me', TestVal, 'find me', ...FinderDouble];
const FinderAlt = [...FinderDouble, 'dont find me', ...FinderDouble];
const RemoveArr = ['safe', TestVal, 'safe', TestVal, 'safe', TestVal, 'safe'];
const RemoveArrRes = ['safe', 'safe', 'safe', 'safe'];
const NonMutatingTests = {
    concat: {
        should: 'concat the value',
        args: ['concatenated'],
        expected: [TestVal, 'concatenated']
    },
    find: {
        should: 'find the wanted value',
        args: [val => val === 'find me'],
        expected: 'find me',
        initial: Finder
    },
    findIndex: {
        should: 'find the index of the wanted value',
        args: [val => val === 'find me'],
        expected: 2,
        initial: Finder
    },
    includes: [
        {
            should: 'check that the object is included',
            args: ['find me'],
            expected: true,
            initial: Finder
        },
        {
            should: 'check that the object is not included',
            args: ['find me'],
            expected: false,
            initial: FinderAlt
        }
    ],
    indexOf: [
        {
            should: 'find the index of the wanted value',
            args: ['find me'],
            expected: 2,
            initial: Finder
        },
        {
            should: 'not find the index of the wanted value',
            args: ['find me'],
            expected: -1,
            initial: FinderAlt
        }
    ],
    lastIndexOf: [
        {
            should: 'find the last index of the wanted value',
            args: ['find me'],
            expected: 4,
            initial: Finder2
        },
        {
            should: 'not find the last index of the wanted value',
            args: ['find me'],
            expected: -1,
            initial: FinderAlt
        }
    ],
    map: {
        should: 'apply the given function on all values',
        args: [val => val + val.split('').reverse().join('')],
        expected: ['testtset', 'reverseesrever', 'racecarracecar'],
        initial: [TestVal, 'reverse', 'racecar']
    },
    filter: {
        should: 'filter out the unwanted values',
        args: [val => val !== TestVal],
        expected: Finder.filter(val => val !== TestVal),
        initial: Finder
    },
    join: {
        should: 'join all the values with a "-"',
        args: ['-'],
        expected: Finder.join('-'),
        initial: Finder
    }
};

module.exports = {
    promisify,
    DB,
    TestVal,
    TestHash,
    TestList,
    DeepHash,
    Tests,
    Finder,
    Finder2,
    FinderAlt,
    RemoveArr,
    RemoveArrRes,
    NonMutatingTests
};
