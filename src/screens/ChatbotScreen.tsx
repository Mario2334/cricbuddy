import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import apiService from '../services/apiService';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface TeamContext {
  teamId: string;
  recentMatches: any[];
  teamStats: any;
}

const ChatbotScreen: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [teamContext, setTeamContext] = useState<TeamContext | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const teamId = '5179117'; // Same team ID as used in MyTeamScreen

  useEffect(() => {
    initializeChatbot();
    loadTeamContext();
  }, []);

  const initializeChatbot = () => {
    const welcomeMessage: Message = {
      id: '1',
      text: 'Hello! I\'m your cricket coach assistant. I have access to your team data and can help you with match analysis, player insights, and strategic advice. What would you like to know?',
      isUser: false,
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
  };

  const loadTeamContext = async () => {
    try {
      // Load recent team matches for context
      const matchesResponse = await apiService.getTeamMatches(teamId, 1, 5);
      const recentMatches = matchesResponse.data || [];
      
      setTeamContext({
        teamId,
        recentMatches,
        teamStats: {}, // Can be expanded with more team statistics
      });
    } catch (error) {
      console.error('Failed to load team context:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    try {
      const response = await sendToOpenRouter(inputText.trim());
      
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response,
        isUser: false,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Sorry, I encountered an error. Please try again.',
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      Alert.alert('Error', 'Failed to get response from chatbot');
    } finally {
      setLoading(false);
    }
  };

  const sendToOpenRouter = async (message: string): Promise<string> => {
    // Prepare context about the team
    const contextPrompt = teamContext ? `
Team Context:
- Team ID: ${teamContext.teamId}
- Recent matches: ${teamContext.recentMatches.length} matches loaded
- Recent match details: ${teamContext.recentMatches.map(match => 
  `${match.team1_name || match.team_a} vs ${match.team2_name || match.team_b} (${match.status})`
).join(', ')}

User question: ${message}

Please provide cricket coaching advice based on the team context above.
    ` : message;

    try {
      // OpenRouter API call
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY || 'YOUR_OPENROUTER_API_KEY'}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://mycoach.app',
          'X-Title': 'MyCoach Cricket Assistant',
        },
        body: JSON.stringify({
          model: 'anthropic/claude-3-haiku',
          messages: [
            {
              role: 'system',
              content: 'You are a cricket coaching assistant with access to team data. Provide helpful, specific advice about cricket strategy, player development, and match analysis based on the provided team context.'
            },
            {
              role: 'user',
              content: contextPrompt
            }
          ],
          max_tokens: 500,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || 'Sorry, I couldn\'t generate a response.';
    } catch (error) {
      console.error('OpenRouter API error:', error);
      throw error;
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[
      styles.messageContainer,
      item.isUser ? styles.userMessage : styles.botMessage
    ]}>
      <Text style={[
        styles.messageText,
        item.isUser ? styles.userMessageText : styles.botMessageText
      ]}>
        {item.text}
      </Text>
      <Text style={styles.timestamp}>
        {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        style={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        onLayout={() => flatListRef.current?.scrollToEnd()}
      />
      
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#0066cc" />
          <Text style={styles.loadingText}>Thinking...</Text>
        </View>
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Ask about your team, matches, or strategy..."
          multiline
          maxLength={500}
          editable={!loading}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || loading) && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={!inputText.trim() || loading}
        >
          <Ionicons name="send" size={20} color={(!inputText.trim() || loading) ? '#ccc' : '#fff'} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  messageContainer: {
    marginVertical: 4,
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#0066cc',
  },
  botMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  userMessageText: {
    color: '#fff',
  },
  botMessageText: {
    color: '#333',
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  loadingText: {
    marginLeft: 8,
    color: '#666',
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 12,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#0066cc',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
});

export default ChatbotScreen;