import { useState, useEffect, useCallback } from 'react';
import { PlayerProfile, MatchRecord, PlayerStats } from '../types';

const PROFILES_KEY = 'tennis_doubles_profiles';
const HISTORY_KEY = 'tennis_doubles_match_history';

const createEmptyStats = (): PlayerStats => ({
    winners: 0, aces: 0, unforcedErrors: 0, forcedErrors: 0, doubleFaults: 0,
    firstServesIn: 0, firstServesTotal: 0, secondServesWon: 0, secondServesTotal: 0, servesUnreturned: 0,
    returnPointsWon: 0, returnPointsTotal: 0, returnWinners: 0, returnUnforcedErrors: 0,
    netPointsApproached: 0, netPointsWon: 0,
    pointsWon: 0, pointsLost: 0,
});

// A simple UUID generator
const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export const usePersistence = () => {
    const [profiles, setProfiles] = useState<PlayerProfile[]>([]);
    const [matchHistory, setMatchHistory] = useState<MatchRecord[]>([]);

    useEffect(() => {
        try {
            const storedProfiles = localStorage.getItem(PROFILES_KEY);
            const storedHistory = localStorage.getItem(HISTORY_KEY);
            if (storedProfiles) {
                setProfiles(JSON.parse(storedProfiles));
            }
            if (storedHistory) {
                setMatchHistory(JSON.parse(storedHistory));
            }
        } catch (error) {
            console.error("Failed to load data from localStorage", error);
        }
    }, []);

    const saveData = (key: string, data: any) => {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (error) {
            console.error("Failed to save data to localStorage", error);
        }
    };

    const addProfile = useCallback((name: string): PlayerProfile => {
        const newProfile: PlayerProfile = {
            id: generateUUID(),
            name,
            matchesPlayed: 0,
            wins: 0,
            losses: 0,
            stats: createEmptyStats(),
        };
        const updatedProfiles = [...profiles, newProfile];
        setProfiles(updatedProfiles);
        saveData(PROFILES_KEY, updatedProfiles);
        return newProfile;
    }, [profiles]);

    const addMatch = useCallback((match: MatchRecord) => {
        const updatedHistory = [match, ...matchHistory];
        setMatchHistory(updatedHistory);
        saveData(HISTORY_KEY, updatedHistory);
    }, [matchHistory]);
    
    const updateProfilesOnMatchEnd = useCallback((match: MatchRecord) => {
        // Only update wins/losses if the match has a winner
        if (typeof match.winner === 'undefined') {
            return;
        }

        const updatedProfiles = JSON.parse(JSON.stringify(profiles));
        
        const updatePlayerProfile = (profileId: string, isWinner: boolean, playerStats: PlayerStats) => {
            const profileIndex = updatedProfiles.findIndex((p: PlayerProfile) => p.id === profileId);
            if (profileIndex === -1) return;

            const profile = updatedProfiles[profileIndex];
            profile.matchesPlayed++;
            if (isWinner) profile.wins++;
            else profile.losses++;

            // Aggregate stats
            for (const key in playerStats) {
                profile.stats[key as keyof PlayerStats] += playerStats[key as keyof PlayerStats];
            }
        };

        const team1Won = match.winner === 1;
        match.team1.players.forEach(p => updatePlayerProfile(p.profileId, team1Won, match.playerStats[p.profileId]));
        match.team2.players.forEach(p => updatePlayerProfile(p.profileId, !team1Won, match.playerStats[p.profileId]));

        setProfiles(updatedProfiles);
        saveData(PROFILES_KEY, updatedProfiles);
    }, [profiles]);

    return { profiles, matchHistory, addProfile, addMatch, updateProfilesOnMatchEnd };
};