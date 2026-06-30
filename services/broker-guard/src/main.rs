use std::env;
use std::io::Read;
use std::process;

/// Fail-closed trading guard. Two modes, one decision function:
///
/// - **CLI mode** (`broker-guard <action>`): inspects `argv[1]`.
/// - **Hook mode** (no argv): Claude Code `PreToolUse` hooks receive the tool
///   call as JSON on **stdin**, not as argv - so a guard that only read argv
///   would inspect nothing and silently approve every order. Here we read stdin,
///   extract the candidate action (the tool name / command / action field), and
///   run the same decision.
///
/// The rule is "illegal states unrepresentable" for trade orders: any place /
/// modify / cancel / GTT action is denied, reads are approved, and anything we
/// cannot positively classify as a read fails closed (denied). Trading is
/// READ-ONLY for any agent/bot; real orders only flow through the separate
/// human-typed-confirmation executor.
fn main() {
    let args: Vec<String> = env::args().collect();

    let action = if args.len() >= 2 {
        args[1].clone()
    } else {
        // Hook mode: the action is in the JSON payload on stdin.
        let mut input = String::new();
        if std::io::stdin().read_to_string(&mut input).is_err() || input.trim().is_empty() {
            eprintln!("SECURITY ERROR: broker-guard received no action (argv or stdin). Failing closed.");
            process::exit(2);
        }
        match extract_action(&input) {
            Some(a) => a,
            None => {
                eprintln!("SECURITY ERROR: broker-guard could not parse an action from the hook payload. Failing closed.");
                process::exit(2);
            }
        }
    };

    // exit(2) is the PreToolUse "block" code (stderr is surfaced to the agent);
    // exit(1) preserves the CLI deny contract. Both are non-zero = denied.
    let deny_code = if args.len() >= 2 { 1 } else { 2 };

    match classify(&action) {
        Decision::Deny => {
            eprintln!("SECURITY ERROR: broker-guard blocked illegal order action '{action}'. Trading is READ-ONLY for the agent loop.");
            process::exit(deny_code);
        }
        Decision::Allow => {
            println!("broker-guard: approved read action '{action}'.");
            process::exit(0);
        }
        Decision::Unknown => {
            eprintln!("SECURITY ERROR: broker-guard blocked unclassified action '{action}'. Failing closed.");
            process::exit(deny_code);
        }
    }
}

enum Decision {
    Allow,
    Deny,
    Unknown,
}

/// Decide on a normalized action token. Order-mutating verbs are denied; known
/// read actions are allowed; everything else fails closed (Unknown -> deny).
fn classify(action: &str) -> Decision {
    let a = action.trim().to_lowercase();
    // Substring match so a namespaced tool name (e.g. "kite.place_order") is
    // still caught, not just the bare verb.
    const DENY: [&str; 7] = [
        "place_order",
        "modify_order",
        "cancel_order",
        "place",
        "modify",
        "cancel",
        "gtt",
    ];
    const ALLOW: [&str; 4] = ["get_positions", "get_holdings", "get_margins", "read"];

    if DENY.iter().any(|d| a.contains(d)) {
        return Decision::Deny;
    }
    if ALLOW.iter().any(|r| a.contains(r)) {
        return Decision::Allow;
    }
    if a == "order" {
        return Decision::Deny;
    }
    Decision::Unknown
}

/// Minimal, dependency-free extraction of the action string from a PreToolUse
/// JSON payload. Checks the fields a broker tool call would carry, in priority
/// order, and concatenates tool name + command so either can trigger a deny.
/// std-only by design (broker-guard must stay a tiny audited binary).
fn extract_action(json: &str) -> Option<String> {
    let mut parts: Vec<String> = Vec::new();
    for key in ["tool_name", "name", "action", "command", "transaction_type"] {
        if let Some(v) = json_string_value(json, key) {
            parts.push(v);
        }
    }
    if parts.is_empty() {
        None
    } else {
        Some(parts.join(" "))
    }
}

/// Find `"key": "value"` in a JSON string and return the (unescaped-enough)
/// value. Handles arbitrary whitespace around the colon. Good enough for the
/// flat tool-call fields we inspect; not a general JSON parser.
fn json_string_value(json: &str, key: &str) -> Option<String> {
    let needle = format!("\"{key}\"");
    let start = json.find(&needle)? + needle.len();
    let rest = &json[start..];
    let colon = rest.find(':')?;
    let after = rest[colon + 1..].trim_start();
    let after = after.strip_prefix('"')?;
    // Take up to the next unescaped quote.
    let mut out = String::new();
    let mut chars = after.chars();
    while let Some(c) = chars.next() {
        match c {
            '\\' => {
                if let Some(next) = chars.next() {
                    out.push(next);
                }
            }
            '"' => return Some(out),
            _ => out.push(c),
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    fn decision(a: &str) -> &'static str {
        match classify(a) {
            Decision::Allow => "allow",
            Decision::Deny => "deny",
            Decision::Unknown => "unknown",
        }
    }

    #[test]
    fn order_actions_are_denied() {
        for a in ["place_order", "modify_order", "cancel_order", "gtt", "order", "kite.place_order"] {
            assert_eq!(decision(a), "deny", "{a} must be denied");
        }
    }

    #[test]
    fn read_actions_are_allowed() {
        for a in ["get_positions", "get_holdings", "get_margins", "read"] {
            assert_eq!(decision(a), "allow", "{a} must be allowed");
        }
    }

    #[test]
    fn unclassified_fails_closed() {
        assert_eq!(decision("frobnicate"), "unknown");
    }

    #[test]
    fn extracts_action_from_hook_json() {
        let json = r#"{"tool_name":"kite_place_order","tool_input":{"command":"BUY 10 INFY"}}"#;
        let action = extract_action(json).unwrap();
        assert!(action.contains("place"));
        assert_eq!(decision(&action), "deny");
    }

    #[test]
    fn extracts_read_from_hook_json() {
        let json = r#"{"tool_name":"kite_get_positions","tool_input":{}}"#;
        let action = extract_action(json).unwrap();
        assert_eq!(decision(&action), "allow");
    }
}
