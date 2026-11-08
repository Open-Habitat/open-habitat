//go:build linux

package daemon

// readNativeSettled projects every visible entry of the active branch. The
// daemon never holds that for a file without a size bound; tests compare
// against it.
func readNativeSettled(path string, uid int) nativeSession {
	return readNativeRetaining(path, uid, retainAll)
}

func readNative(path string, uid int) nativeSession {
	return readNativeKept(path, uid, retainAll)
}
