use std::env;
use std::fs;
use std::io::{Read, Write};
use std::os::fd::AsRawFd;
use std::os::unix::fs::PermissionsExt;
use std::os::unix::net::UnixListener;
use std::path::PathBuf;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut args = env::args().skip(1);
    let socket = PathBuf::from(args.next().ok_or("usage: host-stack-uds-probe SOCKET ALLOWED_UID")?);
    let allowed_uid: libc::uid_t = args
        .next()
        .ok_or("usage: host-stack-uds-probe SOCKET ALLOWED_UID")?
        .parse()?;
    if args.next().is_some() {
        return Err("usage: host-stack-uds-probe SOCKET ALLOWED_UID".into());
    }

    if socket.exists() {
        fs::remove_file(&socket)?;
    }
    let listener = UnixListener::bind(&socket)?;
    fs::set_permissions(&socket, fs::Permissions::from_mode(0o660))?;
    println!("READY {}", socket.display());

    let (mut stream, _) = listener.accept()?;
    let mut credential: libc::ucred = unsafe { std::mem::zeroed() };
    let mut length = std::mem::size_of::<libc::ucred>() as libc::socklen_t;
    let result = unsafe {
        libc::getsockopt(
            stream.as_raw_fd(),
            libc::SOL_SOCKET,
            libc::SO_PEERCRED,
            (&mut credential as *mut libc::ucred).cast(),
            &mut length,
        )
    };
    if result != 0 {
        return Err(std::io::Error::last_os_error().into());
    }

    let mut request = [0_u8; 4096];
    let read = stream.read(&mut request)?;
    let valid_request = request[..read].starts_with(b"GET /healthz HTTP/1.1\r\n");
    let permitted = valid_request && credential.uid == allowed_uid;
    let (status, body) = if permitted {
        ("200 OK", format!("{{\"status\":\"ok\",\"peer_uid\":{}}}\n", credential.uid))
    } else {
        ("403 Forbidden", format!("{{\"status\":\"denied\",\"peer_uid\":{}}}\n", credential.uid))
    };
    write!(
        stream,
        "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    )?;
    stream.flush()?;
    fs::remove_file(&socket)?;
    Ok(())
}
