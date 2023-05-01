import { BskyAgent } from '@atproto/api';
import { ProfileView } from '@atproto/api/dist/client/types/app/bsky/actor/defs';
import React, { FunctionComponent, useState, useEffect } from 'react';
import {
    Text,
    Image,
    Linking,
    StyleSheet,
    View,
} from 'react-native';
import { StatusBar } from "expo-status-bar";
import { AlignmentProps, SubjectData } from './types';
import { useLocalStorageState } from "../helpers/hooks";
import { Decision } from '../helpers/decision';

const mergeSubjectData = (profile: ProfileView, subjects: Map<string, SubjectData>, accept: boolean, weight: number) => {
    let subject: SubjectData = subjects.get(profile.handle) || ({
        profile: profile,
        decisions: [],
    });
    subject.decisions.push(new Decision(accept ? 1.0 : 0.0, accept ? 0.0 : 1.0, 0.0).weight(weight));
    subjects.set(subject.profile.handle, subject);
}

// subjects = follows + followers + follows->blocks+mutes+1st-page-follows
// TODO: loading callback
const fetchSubjects = async (agent: BskyAgent, identifier: string): Promise<Map<string, SubjectData>> => {
    let subjects = new Map<string, SubjectData>();

    console.log('making expensive api calls... sorry BlueSky folks!');

    {
        let follows: ProfileView[] = [];
        let cursor;
        for (let i = 0; i < 10; i++) {
            const response: any = await agent.getFollows({
                actor: identifier,
                cursor,
            });

            if (response.success) {
                follows = follows.concat(response.data.follows);
                if (!response.data.cursor || response.data.follows.length === 0) {
                    break;
                }
                cursor = response.data.cursor;
            } else {
                // TODO: Handle error
                break;
            }
        }
        for (var follow of follows) {
            mergeSubjectData(follow, subjects, true, 0.75);

            {
                // first page only
                const response: any = await agent.getFollows({
                    actor: follow.did,
                });

                if (response.success) {
                    for (var subfollower of response.data.follows) {
                        mergeSubjectData(subfollower, subjects, true, 0.1);
                    }
                } else {
                    // TODO: Handle error
                }
            }

            {
                // first page only
                const response: any = await agent.api.com.atproto.repo.listRecords({
                    repo: follow.did,
                    collection: 'app.bsky.graph.block',
                });

                if (response.success) {
                    let actors = response.data.records.map((blockRecord: any) => {
                        return blockRecord.value.subject;
                    })

                    if (actors.length > 0) {
                        const profileResponse: any = await agent.getProfiles({ actors: actors });
                        if (profileResponse.success) {
                            for (var followBlockee of profileResponse.data.profiles) {
                                mergeSubjectData(followBlockee, subjects, false, 0.4);
                            }
                        } else {
                            // TODO: Handle error
                        }
                    }
                } else {
                    // TODO: Handle error
                }
            }
        }
    }

    {
        let followers: ProfileView[] = [];
        let cursor;
        for (let i = 0; i < 5; i++) {
            const response: any = await agent.getFollowers({
                actor: identifier,
                cursor,
            });

            if (response.success) {
                followers = followers.concat(response.data.followers);
                if (!response.data.cursor || response.data.followers.length === 0) {
                    break;
                }
                cursor = response.data.cursor;
            } else {
                // TODO: Handle error
                break;
            }
        }
        for (var follower of followers) {
            mergeSubjectData(follower, subjects, true, 0.0);
        }
    }

    {
        let viewerBlocks: ProfileView[] = [];
        let cursor;
        for (let i = 0; i < 10; i++) {
            const response: any = await agent.api.app.bsky.graph.getBlocks({
                cursor,
            });

            if (response.success) {
                viewerBlocks = viewerBlocks.concat(response.data.blocks);
                if (!response.data.cursor || response.data.blocks.length === 0) {
                    break;
                }
                cursor = response.data.cursor;
            } else {
                // TODO: Handle error
                break;
            }
        }
        for (var blockee of viewerBlocks) {
            mergeSubjectData(blockee, subjects, false, 1.0);
        }
    }

    {
        let viewerMutes: ProfileView[] = [];
        let cursor;
        for (let i = 0; i < 10; i++) {
            const response: any = await agent.api.app.bsky.graph.getMutes({
                cursor,
            });

            if (response.success) {
                viewerMutes = viewerMutes.concat(response.data.mutes);
                if (!response.data.cursor || response.data.mutes.length === 0) {
                    break;
                }
                cursor = response.data.cursor;
            } else {
                // TODO: Handle error
                break;
            }
        }
        for (var mutee of viewerMutes) {
            mergeSubjectData(mutee, subjects, false, 0.5);
        }
    }

    {
        let suggestions: ProfileView[] = [];
        let cursor;
        for (let i = 0; i < 3; i++) {
            const response: any = await agent.getSuggestions({
                cursor,
            });

            if (response.success) {
                suggestions = suggestions.concat(response.data.actors);
                if (!response.data.cursor || response.data.actors.length === 0) {
                    break;
                }
                cursor = response.data.cursor;
            } else {
                // TODO: Handle error
                break;
            }
        }
        for (var suggestion of suggestions) {
            mergeSubjectData(suggestion, subjects, true, 0.0);
        }
    }

    subjects.forEach((subject) => {
        if (subject.profile.viewer) {
            if (subject.profile.viewer.blockedBy) {
                subject.decisions.push(new Decision(0.0, 0.3, 0.7));
            }
        }
    });

    console.log('expensive api calls done');

    return subjects;
}

const pignisticTransformSubjects = (subjects: Map<string, SubjectData>) => {
    subjects.forEach((subject) => {
        subject.pignistic = Decision.combine_murphy(subject.decisions).pignistic().accept;
    });
}

const pruneSubjects = (subjects: Map<string, SubjectData>) => {
    subjects.forEach((subject, handle) => {
        if (subject.decisions.length == 0 || subject.decisions.every((decision) => { return decision.unknown > 0.99 })) {
            subjects.delete(handle);
        }
    });
}

const Alignment: FunctionComponent<AlignmentProps> = (props) => {
    const [subjects, setSubjects] =
        useLocalStorageState<Array<SubjectData> | null>(
            "@subjects",
            null
        );
    useEffect(() => {
        if (!!props.agent && !!props.identifier && !subjects) {
            // I clearly don't understand useEffect, shouldn't subject be non-nil here if we already have local data?
            fetchSubjects(props.agent, props.identifier).then(async (subjects) => {
                pignisticTransformSubjects(subjects);
                pruneSubjects(subjects);
                if (props.identifier) {
                    // we don't need to check ourselves
                    subjects.delete(props.identifier);
                }
                let sortedSubjects: SubjectData[] = [];
                subjects.forEach((subject) => {
                    sortedSubjects.push(subject);
                });
                sortedSubjects.sort((a, b) => {
                    return (b.pignistic || 0.0) - (a.pignistic || 0.0);
                });
                setSubjects(sortedSubjects);
            });
        }
    });
    return (
        <>
            <StatusBar style="auto" />
            <View style={styles.container}>
                {subjects ? (
                    <Text>
                        Higher numbers indicate greater overall alignment with your existing network. Lower numbers indicate profiles that your network has mutually blocked.
                    </Text>
                ) : (<></>)}
                {subjects ? subjects.map((subject) => (
                    <View key={subject.profile.handle || subject.profile.did} style={styles.profile}>
                        <View>
                            {subject.profile.avatar ? (
                                <Image style={styles.avatar} source={{ uri: subject.profile.avatar, height: 40, width: 40 }} />
                            ) : (
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="none">
                                    <circle cx="12" cy="12" r="12" fill="#0070ff"></circle>
                                    <circle cx="12" cy="9.5" r="3.5" fill="#fff"></circle>
                                    <path strokeLinecap="round" strokeLinejoin="round" fill="#fff"
                                        d="M 12.058 22.784 C 9.422 22.784 7.007 21.836 5.137 20.262 C 5.667 17.988 8.534 16.25 11.99 16.25 C 15.494 16.25 18.391 18.036 18.864 20.357 C 17.01 21.874 14.64 22.784 12.058 22.784 Z">
                                    </path>
                                </svg>
                            )}
                        </View>
                        <View style={styles.nameContainer}>
                            <Text
                                onPress={() => Linking.openURL(`https://staging.bsky.app/profile/${subject.profile.handle}`)}
                                role="link"
                                style={styles.profileDisplayName}
                            >
                                {subject.profile.displayName}
                            </Text>
                            <Text
                                onPress={() => Linking.openURL(`https://staging.bsky.app/profile/${subject.profile.handle}`)}
                                role="link"
                                style={styles.profileHandle}
                            >
                                @{subject.profile.handle}
                            </Text>
                        </View>
                        <Text>{(subject.pignistic || 0.0).toLocaleString(undefined, { maximumFractionDigits: 3 })}</Text>
                    </View>
                )) : (
                    <Text>Trying your patience... slowly fetching data from your graph... setting BlueSky's servers on 🔥...</Text>
                )}
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        marginVertical: 8,
    },
    avatar: {
        borderRadius: 20,
        height: 40,
        width: 40,
    },
    profile: {
        alignItems: 'stretch',
        marginTop: 8,
        marginBottom: 10,
        padding: 12,
        borderColor: '#e0d9d9',
        borderWidth: 1,
        borderRadius: 8,
        display: 'flex',
        flexBasis: 'auto',
        flexDirection: 'row',
        flexShrink: 0,
    },
    nameContainer: {
        paddingHorizontal: 8,
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: '0%',
    },
    profileDisplayName: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    profileHandle: {
        fontSize: 15,
        color: '#545664',
    },
});

export default Alignment;
