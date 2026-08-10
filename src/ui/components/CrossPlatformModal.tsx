import { Modal, type ModalProps } from 'react-native';

/** Native uses React Native's platform modal controller. */
export function CrossPlatformModal(props: ModalProps) {
  return <Modal {...props} />;
}
