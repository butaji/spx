#!/bin/bash
# Improved device discovery script using background processes

echo "=== Spotify Device Discovery Test ==="
echo ""

browse_service() {
    local service_type=$1
    local label=$2
    
    echo "--- Scanning for $label ($service_type) ---"
    
    # Browse for services - run in background, kill after 3 seconds
    local browse_file="/tmp/dns-sd-browse-$$.txt"
    /usr/bin/dns-sd -B "$service_type" local > "$browse_file" 2>&1 &
    local browse_pid=$!
    sleep 3
    kill $browse_pid 2>/dev/null
    wait $browse_pid 2>/dev/null
    
    # Parse instance names (skip header, get last column)
    local instances
    instances=$(cat "$browse_file" | grep "Add" | sed 's/^.*\.\s*//' | sort -u)
    
    rm -f "$browse_file"
    
    if [ -z "$instances" ]; then
        echo "  No devices found"
        return
    fi
    
    local count
    count=$(echo "$instances" | grep -c '^' || echo 0)
    echo "  Found $count device(s):"
    
    while IFS= read -r instance; do
        [ -z "$instance" ] && continue
        
        echo ""
        echo "  Instance: $instance"
        
        # Resolve - run in background, kill after 3 seconds
        local resolve_file="/tmp/dns-sd-resolve-$$.txt"
        /usr/bin/dns-sd -L "$instance" "$service_type" local > "$resolve_file" 2>&1 &
        local resolve_pid=$!
        sleep 3
        kill $resolve_pid 2>/dev/null
        wait $resolve_pid 2>/dev/null
        
        # Parse output
        local reachable_line
        reachable_line=$(grep "can be reached at" "$resolve_file" | head -1)
        
        if [ -n "$reachable_line" ]; then
            # Extract address
            local addr
            addr=$(echo "$reachable_line" | sed 's/.*can be reached at //' | sed 's/ (interface.*//')
            echo "    Address: $addr"
        fi
        
        # Extract friendly name
        local fn
        fn=$(grep " fn=" "$resolve_file" | sed 's/.* fn=//' | sed 's/ .*//' | sed 's/\\ / /g' | head -1)
        if [ -n "$fn" ]; then
            echo "    Friendly Name: $fn"
        fi
        
        # Extract model
        local md
        md=$(grep " md=" "$resolve_file" | sed 's/.* md=//' | sed 's/ .*//' | sed 's/\\ / /g' | head -1)
        if [ -n "$md" ]; then
            echo "    Model: $md"
        fi
        
        rm -f "$resolve_file"
        
    done <<< "$instances"
}

echo "Test 1: Google Cast devices"
browse_service "_googlecast._tcp" "Google Cast"

echo ""
echo "Test 2: Spotify Connect devices"
browse_service "_spotify-connect._tcp" "Spotify Connect"

echo ""
echo "=== Test Complete ==="
