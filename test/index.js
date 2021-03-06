import test from 'ava';
import {jsdom} from 'jsdom';
import unexpected from 'unexpected';
import unexpectedReact from 'unexpected-react';
import {uniqBy} from 'lodash';
import * as ReactTestUtils from 'react-addons-test-utils';
import * as React from 'react';

import factory from '../source';

import {
	runTimes,
	virtualModule,
	StatelessWrapper, // eslint-disable-line no-unused-vars,
	trap
} from './_helpers';

import * as mocks from './_mocks';

// Provide an emulated DOM environment for React testing
global.document = jsdom('<body></body>');
global.window = global.document.defaultView;
global.navigator = global.window.navigator;

const expect = unexpected.clone()
	.use(unexpectedReact);

test.beforeEach(t => {
	t.context.transform = factory(mocks.application);
});

test('it should export a function as default', t => {
	const actual = typeof factory;
	const expected = 'function';
	t.deepEqual(actual, expected);
});

test('calling the function should return a function', t => {
	const actual = typeof factory(mocks.application);
	const expected = 'function';
	t.deepEqual(actual, expected);
});

test('calling the returned function should return a promise', t => {
	const {context: {transform}} = t;
	const actual = transform(mocks.emptyFile).constructor.name;
	const expected = 'Promise';
	t.deepEqual(actual, expected);
});

test('the returned promise should resolve to an object', async t => {
	const {context: {transform}} = t;
	const actual = Object.prototype.toString(await transform(mocks.emptyFile));
	const expected = '[object Object]';
	t.deepEqual(actual, expected);
});

test('the resolved object should have a buffer key', async t => {
	const {context: {transform}} = t;
	const file = await transform(mocks.emptyFile);
	t.truthy(Object.prototype.hasOwnProperty.call(file, 'buffer'));
});

test('when transforming plain jsx', async t => {
	const {context: {transform}} = t;
	const result = await transform(mocks.plainFile);

	{
		const actual = virtualModule(result.buffer);
		const value = actual();
		t.false(value.constructor === actual, 'it should return a function');
	}

	{
		const Component = virtualModule(result.buffer); // eslint-disable-line no-unused-vars
		const actual = ReactTestUtils.renderIntoDocument(
			<StatelessWrapper><Component/></StatelessWrapper>
		);
		const expected = <div></div>;
		expect(actual, 'to have rendered', expected);
	}
});

test('when transforming a react stateless component', async t => {
	const {context: {transform}} = t;
	const result = await transform(mocks.statelessFile);

	{
		const actual = virtualModule(result.buffer);
		const value = actual();
		t.false(value.constructor === actual, 'it should return a function');
	}

	{
		const Component = virtualModule(result.buffer); // eslint-disable-line no-unused-vars
		const actual = ReactTestUtils.renderIntoDocument(
			<StatelessWrapper><Component/></StatelessWrapper>
		);
		const expected = <div></div>;
		expect(actual, 'to have rendered', expected);
	}

	{
		const Component = virtualModule(result.buffer); // eslint-disable-line no-unused-vars
		const actual = ReactTestUtils.renderIntoDocument(
			<StatelessWrapper><Component/></StatelessWrapper>
		);
		const expected = <div></div>;
		expect(actual, 'to have rendered', expected);
	}
});

test('when transforming a react class declaration', async t => {
	const {context: {transform}} = t;
	const result = await transform(mocks.fullFile);

	{
		const Actual = virtualModule(result.buffer);
		t.truthy(new Actual() instanceof Actual, 'it should return a class');
	}

	{
		const Component = virtualModule(result.buffer); // eslint-disable-line no-unused-vars
		const actual = ReactTestUtils.renderIntoDocument(<Component />);
		const expected = <div></div>;
		expect(actual, 'to have rendered', expected);
	}
});

test('when transforming invalid plain jsx', t => {
	const {context: {transform}} = t;
	const execution = transform(mocks.plainAsiFile);
	t.throws(execution, Error, 'it should fail');
});

test(
	'when transforming plain jsx with variable declaration with identifier "props"',
	async t => {
		const {context: {transform}} = t;
		const release = trap();
		const result = await transform(mocks.reservedPropsDeclaration);

		{
			const Actual = virtualModule(result.buffer);
			t.truthy(new Actual() instanceof Actual, 'it should return a class');
		}

		{
			const Component = virtualModule(result.buffer); // eslint-disable-line no-unused-vars
			const props = {id: 'foo', className: 'baz'};
			const actual = ReactTestUtils.renderIntoDocument(<Component {...props}/>);
			const expected = <div className="bar">foo</div>;
			expect(actual, 'to have rendered', expected);
		}

		const {errors} = release();
		expect(errors, 'to be empty');
	}
);

test(
	'when transforming plain jsx with variable declaration  with identifier "context"',
	async t => {
		const {context: {transform}} = t;
		const release = trap();
		const result = await transform(mocks.reservedContextDeclaration);

		const Actual = virtualModule(result.buffer);
		t.truthy(new Actual() instanceof Actual, 'it should return a class');

		const Component = virtualModule(result.buffer); // eslint-disable-line no-unused-vars
		const props = {id: 'foo', className: 'baz'};
		const actual = ReactTestUtils.renderIntoDocument(<Component {...props}/>);
		const expected = <div className="bar">foo</div>;
		expect(actual, 'to have rendered', expected);

		const {errors} = release();
		expect(errors, 'to be empty');
	}
);

test(
	'when transforming plain jsx with member expressions to "this"',
	async t => {
		const {context: {transform}} = t;
		const result = await transform(mocks.plainThis);
		const Component = virtualModule(result.buffer); // eslint-disable-line no-unused-vars

		const props = {
			foo: {id: 'bar', children: 'bar'},
			id: 'foo', children: 'foo'
		};

		const actual = ReactTestUtils.renderIntoDocument(
			<StatelessWrapper>
				<Component {...props}>foo</Component>
			</StatelessWrapper>
		);

		{
			const expected = <div id="foo">foo<div id="bar">bar</div></div>;
			expect(actual, 'to have rendered', expected);
		}
	}
);

test(
	'when transforming plain jsx with state handling',
	async t => {
		const {context: {transform}} = t;
		const result = await transform(mocks.plainState);
		const Component = virtualModule(result.buffer); // eslint-disable-line no-unused-vars

		const actual = ReactTestUtils.renderIntoDocument(
			<StatelessWrapper><Component/></StatelessWrapper>
		);

		{
			const expected = <div/>;
			expect(actual, 'to have rendered', expected);
		}

		{
			const expected = <div className="tainted"/>;
			expect(actual,
				'with event click', 'on', <Component eventTarget/>,
				'to have rendered', expected);
		}
	}
);

test(
	[
		'when transforming plain jsx with a conflicting variable declarator to a',
		'stateless component'
	].join(' '),
	t => {
		const {context: {transform}} = t;
		const execution = transform(mocks.variableDeclarator);
		t.notThrows(execution, 'it should not fail');
	}
);

test(
	[
		'when transforming plain jsx with a conflicting function declarator to a',
		'stateless component'
	].join(' '),
	async t => {
		const {context: {transform}} = t;
		const execution = transform(mocks.functionDeclarator);
		t.notThrows(execution, 'it should not fail');
	}
);

test(
	[
		'when transforming plain jsx with a conflicting class declarator to a',
		'stateless component'
	].join(' '),
	t => {
		const {context: {transform}} = t;
		const execution = transform(mocks.classDeclarator);
		t.notThrows(execution, 'it should not fail');
	}
);

test(
	'when transforming plain jsx with implicit dependencies',
	async t => {
		const {context: {transform}} = t;
		const result = await transform(mocks.implicitDependencies);
		const Component = virtualModule(result.buffer); // eslint-disable-line no-unused-vars

		t.throws(() => {
			ReactTestUtils.renderIntoDocument(<StatelessWrapper><Component/></StatelessWrapper>);
		}, /Dependency is not defined/, 'it should fail');
	}
);

test(
	'when running the transform multiple times on the same file',
	async t => {
		const {context: {transform}} = t;
		const results = await runTimes(transform, 10, mocks.explicitDependencies);
		const actual = uniqBy(results, 'buffer').length;
		const expected = 1;
		t.is(actual, expected, 'the buffer should not change');
	}
);

test(
	'when transforming a file with explicit dependencies',
	async t => {
		const {context: {transform}} = t;
		const execution = transform(mocks.explicitDependencies);

		const expected = ['react', 'lodash'];
		const unwanted = 'lodash/fp';
		const {meta: {dependencies: actual}} = await execution;

		expect(actual, 'to contain', ...expected);
		expect(actual, 'not to contain', unwanted);
	}
);

test(
	'when transforming a plain file with React require call',
	async t => {
		const {context: {transform}} = t;
		const actual = await transform(mocks.simpleFile);
		expect(actual.buffer, 'to match', /require\(['"]react['"]\)/g)
			.then(c => {
				expect(c.length, 'to be', 1);
			});
	}
);

test(
	'when transforming a file',
	async t => {
		const {context: {transform}} = t;
		const actual = await transform(mocks.simpleFile);
		const expected = `React.createElement("div", {    ...props,    ...{      className: props.className    }  }, React.createElement(Dependency, null));`;
		expect(actual.buffer.split('\n').join(''), 'to contain', expected);
	}
);

test(
	'when transforming plain jsx with injected globals',
	async t => {
		const {context: {transform}} = t;
		const data = {foo: 'foo', bar: 'bar'};
		const result = await transform(mocks.injectedGlobals, null, {opts: {globals: data}});
		const Component = virtualModule(result.buffer); // eslint-disable-line no-unused-vars

		const actual = ReactTestUtils.renderIntoDocument(
			<StatelessWrapper><Component/></StatelessWrapper>
		);

		const expected = <div>foo - bar</div>;
		expect(actual, 'to have rendered', expected);
	}
);
