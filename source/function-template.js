import template from 'babel-template';

export default template(`
	function NAME (props) {
		AUXILIARY;
		return (JSX);
	}
`, {
	sourceType: 'module'
});

module.change_code = 1; // eslint-disable-line