import applyLayout from '../../modules/applyLayout';
import applyNativeMethods from '../../modules/applyNativeMethods';
import createDOMElement from '../../modules/createDOMElement';
import findNodeHandle from '../../modules/findNodeHandle';
import StyleSheet from '../../apis/StyleSheet';
import Text from '../Text';
import TextInputState from './TextInputState';
import UIManager from '../../apis/UIManager';
import View from '../View';
import React, { Component, PropTypes } from 'react';

const emptyObject = {};

/**
 * React Native events differ from W3C events.
 */
const normalizeEventHandler = (handler) => (e) => {
  if (handler) {
    e.nativeEvent.text = e.target.value;
    return handler(e);
  }
};

/**
 * Determines whether a 'selection' prop differs from a node's existing
 * selection state.
 */
const isSelectionStale = (node, selection) => {
  if (node && selection) {
    const { selectionEnd, selectionStart } = node;
    const { start, end } = selection;
    return start !== selectionStart || end !== selectionEnd;
  }
  return false;
};

/**
 * Certain input types do no support 'selectSelectionRange' and will throw an
 * error.
 */
const setSelection = (node, selection) => {
  try {
    if (isSelectionStale(node, selection)) {
      const { start, end } = selection;
      node.setSelectionRange(start, end || start);
    }
  } catch (e) {}
};

class TextInput extends Component {
  static displayName = 'TextInput';

  static propTypes = {
    ...View.propTypes,
    autoCapitalize: PropTypes.oneOf([ 'characters', 'none', 'sentences', 'words' ]),
    autoComplete: PropTypes.string,
    autoCorrect: PropTypes.bool,
    autoFocus: PropTypes.bool,
    blurOnSubmit: PropTypes.bool,
    clearTextOnFocus: PropTypes.bool,
    defaultValue: PropTypes.string,
    editable: PropTypes.bool,
    keyboardType: PropTypes.oneOf([
      'default', 'email-address', 'number-pad', 'numeric', 'phone-pad', 'search', 'url', 'web-search'
    ]),
    maxLength: PropTypes.number,
    multiline: PropTypes.bool,
    numberOfLines: PropTypes.number,
    onBlur: PropTypes.func,
    onChange: PropTypes.func,
    onChangeText: PropTypes.func,
    onFocus: PropTypes.func,
    onKeyPress: PropTypes.func,
    onSelectionChange: PropTypes.func,
    onSubmitEditing: PropTypes.func,
    placeholder: PropTypes.string,
    placeholderTextColor: PropTypes.string,
    secureTextEntry: PropTypes.bool,
    selectTextOnFocus: PropTypes.bool,
    selection: PropTypes.shape({
      start: PropTypes.number.isRequired,
      end: PropTypes.number
    }),
    style: Text.propTypes.style,
    value: PropTypes.string
  };

  static defaultProps = {
    autoCapitalize: 'sentences',
    autoComplete: 'on',
    autoCorrect: true,
    editable: true,
    keyboardType: 'default',
    multiline: false,
    numberOfLines: 0,
    secureTextEntry: false,
    style: emptyObject
  };

  blur() {
    TextInputState.blurTextInput(this._node);
  }

  clear() {
    this._node.value = '';
  }

  focus() {
    TextInputState.focusTextInput(this._node);
  }

  isFocused() {
    return TextInputState.currentlyFocusedField() === this._node;
  }

  setNativeProps(props) {
    UIManager.updateView(this._node, props, this);
  }

  componentDidMount() {
    setSelection(this._node, this.props.selection);
    this._updateMirror();
  }

  componentDidUpdate() {
    setSelection(this._node, this.props.selection);
  }

  render() {
    const {
      autoCorrect,
      editable,
      keyboardType,
      multiline,
      secureTextEntry,
      style,
      /* eslint-disable */
      blurOnSubmit,
      clearTextOnFocus,
      dataDetectorTypes,
      enablesReturnKeyAutomatically,
      keyboardAppearance,
      numberOfLines,
      onChangeText,
      onContentSizeChange,
      onEndEditing,
      onLayout,
      onSelectionChange,
      onSubmitEditing,
      placeholderTextColor,
      returnKeyType,
      selection,
      selectionColor,
      selectTextOnFocus,
      /* eslint-enable */
      ...otherProps
    } = this.props;

    let type;

    switch (keyboardType) {
      case 'email-address':
        type = 'email';
        break;
      case 'number-pad':
      case 'numeric':
        type = 'number';
        break;
      case 'phone-pad':
        type = 'tel';
        break;
      case 'search':
      case 'web-search':
        type = 'search';
        break;
      case 'url':
        type = 'url';
        break;
      default:
        type = 'text';
    }

    if (secureTextEntry) {
      type = 'password';
    }

    const component = multiline ? 'textarea' : 'input';

    Object.assign(otherProps, {
      autoCorrect: autoCorrect ? 'on' : 'off',
      dir: 'auto',
      onBlur: normalizeEventHandler(this._handleBlur),
      onChange: normalizeEventHandler(this._handleChange),
      onFocus: normalizeEventHandler(this._handleFocus),
      onKeyPress: normalizeEventHandler(this._handleKeyPress),
      onSelect: normalizeEventHandler(this._handleSelectionChange),
      readOnly: !editable,
      ref: this._setNode,
      style: [
        styles.initial,
        style,
        multiline && styles.multiline
      ]
    });

    let mirrorProps;
    if (multiline) {
      mirrorProps = {
        ref: this._setMirrorNode,
        style: [
          otherProps.style,
          styles.mirror
        ]
      };
    } else {
      otherProps.type = type;
    }

    const textinput = createDOMElement(component, otherProps);

    return multiline ? (
      <View style={styles.multilineContainer}>
        {createDOMElement('div', { children: textinput, style: [ styles.multilineTextareaContainer ] })}
        {createDOMElement('div', mirrorProps)}
      </View>
    ) : textinput;
  }

  _handleBlur = (e) => {
    const { onBlur } = this.props;
    if (onBlur) { onBlur(e); }
  }

  _handleChange = (e) => {
    const { onChange, onChangeText } = this.props;
    const { text } = e.nativeEvent;
    this._updateMirror();
    if (onChange) { onChange(e); }
    if (onChangeText) { onChangeText(text); }
  }

  _handleFocus = (e) => {
    const { clearTextOnFocus, onFocus, selectTextOnFocus } = this.props;
    const node = this._node;
    if (onFocus) { onFocus(e); }
    if (clearTextOnFocus) { this.clear(); }
    if (selectTextOnFocus) { node && node.select(); }
  }

  _handleKeyPress = (e) => {
    const { blurOnSubmit, multiline, onKeyPress, onSubmitEditing } = this.props;
    const blurOnSubmitDefault = !multiline;
    const shouldBlurOnSubmit = blurOnSubmit == null ? blurOnSubmitDefault : blurOnSubmit;
    if (onKeyPress) { onKeyPress(e); }
    if (!e.isDefaultPrevented() && e.which === 13) {
      if (onSubmitEditing) { onSubmitEditing(e); }
      if (shouldBlurOnSubmit) { this.blur(); }
    }
  }

  _handleSelectionChange = (e) => {
    const { onSelectionChange, selection = emptyObject } = this.props;
    if (onSelectionChange) {
      try {
        const node = e.target;
        if (isSelectionStale(node, selection)) {
          const { selectionStart, selectionEnd } = node;
          e.nativeEvent.selection = { start: selectionStart, end: selectionEnd };
          onSelectionChange(e);
        }
      } catch (e) {}
    }
  }

  _setNode = (component) => {
    this._node = findNodeHandle(component);
  }

  _setMirrorNode = (component) => {
    this._mirrorNode = findNodeHandle(component);
  }

  _getNodeValue() {
    return this._node.value || this._node.placeholder;
  }

  _updateMirror() {
    const { multiline, numberOfLines } = this.props;
    if (multiline) {
      this._mirrorNode.style.width = `${this._node.getBoundingClientRect().width}px`;
      this._mirrorNode.innerHTML = this._constrain(numberOfLines > 0 ?
        new Array(numberOfLines) :
        this._getNodeValue().split('\n'));
    }
  }

  _constrain(tokens = [ '' ]) {
    const _tokens = tokens.slice(0);
    while (this.rows > 0 && _tokens.length < this.rows) {
      _tokens.push('');
    }
    return `${_tokens.join('<br/>')}&#160;`;
  }
}

const styles = StyleSheet.create({
  initial: {
    appearance: 'none',
    backgroundColor: 'transparent',
    borderColor: 'black',
    borderRadius: 0,
    borderWidth: 0,
    boxSizing: 'border-box',
    color: 'inherit',
    font: 'inherit',
    padding: 0
  },
  multilineContainer: {
    position: 'relative',
    overflow: 'hidden'
  },
  multilineTextareaContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    bottom: 0
  },
  multiline: {
    height: '100%',
    position: 'relative',
    resize: 'none'
  },
  mirror: {
    visibility: 'hidden'
  }
});

module.exports = applyLayout(applyNativeMethods(TextInput));
