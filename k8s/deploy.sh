#!/usr/bin/env bash
set -e

echo "=== 🚀 Live Streaming Platform Kubernetes Deployment ==="

# 1. Ensure Namespace exists
kubectl apply -f k8s/namespace.yaml

# 2. Authenticate with AWS ECR (optional if cluster nodes have IAM ECR pull permissions)
# aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 585768182430.dkr.ecr.us-east-1.amazonaws.com

# 3. Apply all Kubernetes manifests using Kustomize
echo "⚙️ Applying Kubernetes resources..."
kubectl apply -k k8s/

# 4. Check rollout status for StatefulSets and Deployments
echo "🔍 Checking rollout status..."
kubectl rollout status statefulset/postgres -n live-stream
kubectl rollout status statefulset/redis -n live-stream
kubectl rollout status statefulset/redpanda -n live-stream
kubectl rollout status deployment/auth-service -n live-stream
kubectl rollout status deployment/meeting-service -n live-stream
kubectl rollout status deployment/signaling-service -n live-stream
kubectl rollout status deployment/api-gateway -n live-stream
kubectl rollout status deployment/frontend-web -n live-stream

echo "✅ Deployment complete! Run 'kubectl get pods -n live-stream' to view active pods."
