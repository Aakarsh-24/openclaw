#!/usr/bin/env bash
# AWS GPU Instance Manager

set -euo pipefail

CREDS="$HOME/.openclaw/credentials/aws-instance.json"

if [[ ! -f "$CREDS" ]]; then
  echo "❌ AWS instance credentials not found at $CREDS" >&2
  exit 1
fi

INSTANCE_ID=$(jq -r '.instance_id' "$CREDS")
REGION=$(jq -r '.region' "$CREDS")
SSH_KEY=$(jq -r '.ssh_key' "$CREDS" | sed "s|^~|$HOME|")
USER=$(jq -r '.user' "$CREDS")

CMD="${1:-status}"

case "$CMD" in
  start)
    echo "🚀 Starting instance $INSTANCE_ID..."
    aws ec2 start-instances --instance-ids "$INSTANCE_ID" --region "$REGION"
    echo "⏳ Waiting for instance to start..."
    aws ec2 wait instance-running --instance-ids "$INSTANCE_ID" --region "$REGION"
    PUBLIC_IP=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" --region "$REGION" --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)
    echo "✅ Instance started! New public IP: $PUBLIC_IP"
    echo "🔧 Update credentials:"
    echo "  jq '.current_public_ip = \"$PUBLIC_IP\"' $CREDS > ${CREDS}.tmp && mv ${CREDS}.tmp $CREDS"
    ;;
  
  stop)
    echo "⏸️  Stopping instance $INSTANCE_ID..."
    aws ec2 stop-instances --instance-ids "$INSTANCE_ID" --region "$REGION"
    echo "✅ Stop command sent (will take ~2 minutes)"
    ;;
  
  status)
    echo "📊 Instance Status for $INSTANCE_ID"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    aws ec2 describe-instances --instance-ids "$INSTANCE_ID" --region "$REGION" \
      --query 'Reservations[0].Instances[0].{State:State.Name,PublicIP:PublicIpAddress,PrivateIP:PrivateIpAddress,Type:InstanceType,AZ:Placement.AvailabilityZone}' \
      --output table
    ;;
  
  ip)
    PUBLIC_IP=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" --region "$REGION" --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)
    echo "$PUBLIC_IP"
    ;;
  
  ssh)
    PUBLIC_IP=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" --region "$REGION" --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)
    if [[ "$PUBLIC_IP" == "None" || -z "$PUBLIC_IP" ]]; then
      echo "❌ Instance is not running or has no public IP" >&2
      exit 1
    fi
    echo "🔌 Connecting to $USER@$PUBLIC_IP..."
    shift || true
    exec ssh -i "$SSH_KEY" "$USER@$PUBLIC_IP" "$@"
    ;;
  
  help|--help|-h)
    cat <<EOF
AWS GPU Instance Manager

Usage: $0 <command>

Commands:
  start    Start the instance and wait for it to be running
  stop     Stop the instance (saves GPU costs)
  status   Show current instance state and IP
  ip       Get current public IP (for scripts)
  ssh      SSH into the instance (pass extra args after ssh)
  help     Show this help

Examples:
  $0 start
  $0 status
  $0 ssh
  $0 ssh 'nvidia-smi'

Instance: $INSTANCE_ID ($REGION)
EOF
    ;;
  
  *)
    echo "Unknown command: $CMD" >&2
    echo "Run '$0 help' for usage" >&2
    exit 1
    ;;
esac
